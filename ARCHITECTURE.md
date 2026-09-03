# ReachInbox Email Scheduler - Architecture Documentation

## System Architecture Overview

### Three-Process Model

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│                     (React + Vite Frontend)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/REST
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EXPRESS API SERVER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Routes     │→ │ Controllers  │→ │  Services    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                             │                                     │
│                    ┌────────┴────────┐                          │
│                    ▼                 ▼                           │
│            ┌──────────────┐  ┌──────────────┐                  │
│            │ Repositories │  │ Queue Manager│                  │
│            └──────┬───────┘  └──────┬───────┘                  │
└────────────────────┼──────────────────┼────────────────────────┘
                     │                  │
         ┌───────────┼──────────────────┼──────────────┐
         │           ▼                  ▼              │
         │   ┌──────────────┐  ┌──────────────┐       │
         │   │  PostgreSQL  │  │ Redis/BullMQ │       │
         │   │   Database   │  │    Queue     │       │
         │   └──────────────┘  └──────┬───────┘       │
         │                             │               │
         │                             ▼               │
         │                   ┌──────────────────┐     │
         │                   │  WORKER PROCESS  │     │
         │                   │  (BullMQ Consume)│     │
         │                   └────────┬─────────┘     │
         │                            │               │
         │        ┌───────────────────┼────────────┐  │
         │        ▼                   ▼            ▼  │
         │  ┌──────────┐      ┌──────────┐  ┌────────┴───┐
         └─▶│Ethereal  │      │Elastic   │  │   Slack    │
            │  SMTP    │      │ Search   │  │    API     │
            └──────────┘      └──────────┘  └────────────┘
```

---

## Data Flow: Campaign Creation to Email Delivery

### 1. User Creates Campaign

```
User submits form
    ↓
Frontend validates (Zod)
    ↓
POST /api/campaigns
    ↓
Controller → Service
    ↓
Parse CSV/TXT recipients
    ↓
Validate email addresses
    ↓
Calculate scheduled times
    ↓
Transaction:
  - Create EmailCampaign record
  - Create EmailJob records (1 per recipient)
  - Generate idempotency keys
    ↓
For each EmailJob:
  - Calculate delay = scheduledAt - now
  - Create BullMQ delayed job
  - Store bullJobId in database
    ↓
Return success to user
```

### 2. Worker Processes Jobs

```
BullMQ job becomes ready (delay expired)
    ↓
Worker picks up job
    ↓
Fetch EmailJob from database
    ↓
Check status (idempotency)
    ├─ If SENT → Skip
    └─ If PENDING → Continue
        ↓
    Check rate limit (Redis INCR)
    ├─ If over limit:
    │   ↓
    │   Calculate next available hour
    │   ↓
    │   Re-enqueue with new delay
    │   ↓
    │   Send Slack notification
    │   ↓
    │   Update status to DELAYED
    │
    └─ If under limit:
        ↓
        Update status to PROCESSING
        ↓
        Send via Nodemailer/Ethereal
        ↓
        Update status to SENT
        ↓
        Record sentAt timestamp
        ↓
        Index in Elasticsearch
        ↓
        Job complete
```

---

## Rate Limiting Algorithm

### Redis Key Structure
```
Key:   rate_limit:{senderId}:{YYYY-MM-DD-HH}
Value: integer (count of emails sent)
TTL:   2 hours
```

### Flow
```
Before sending email:
    ↓
Determine current hour window
Example: 2026-09-03 10:45:23 → "2026-09-03-10"
    ↓
Redis INCR rate_limit:{senderId}:{window}
    ↓
Get current count
    ↓
If count <= MAX_EMAILS_PER_HOUR_PER_SENDER:
    ✅ Send email
    Update database
Else:
    ⚠️ Limit exceeded
    Calculate next window: "2026-09-03-11"
    Calculate delay until next window
    Re-enqueue job with new delay
    Send Slack notification
    Update status to DELAYED
```

### Why Redis?
- ✅ Atomic INCR operation
- ✅ Works across multiple workers
- ✅ No in-memory state
- ✅ TTL auto-cleanup

---

## Idempotency Strategy

### Idempotency Key Generation
```typescript
idempotencyKey = hash(campaignId + recipientEmail + scheduledAt)
```

### Database State Machine
```
PENDING
   ↓ Worker starts processing
PROCESSING
   ↓ Email sent successfully
SENT
   ↓ (Terminal state)

   ↓ Email send failed
FAILED
   ↓ (Terminal state)

   ↓ Rate limit hit
DELAYED
   ↓ Re-queued for later
PENDING (again)
```

### Worker Idempotency Check
```typescript
// Worker job handler
async function processEmailJob(jobData) {
  const emailJob = await db.findEmailJob(jobData.emailJobId);
  
  // Critical: Check current state
  if (emailJob.status === 'sent') {
    logger.info('Already sent, skipping');
    return; // Safe to skip
  }
  
  if (emailJob.status === 'processing') {
    logger.warn('Already processing, possible duplicate job');
    return; // Safe to skip
  }
  
  // Update to processing (use transaction or SELECT FOR UPDATE)
  await db.updateEmailJob(emailJob.id, { status: 'processing' });
  
  try {
    await sendEmail(emailJob);
    await db.updateEmailJob(emailJob.id, { 
      status: 'sent', 
      sentAt: new Date() 
    });
  } catch (error) {
    await db.updateEmailJob(emailJob.id, { 
      status: 'failed',
      failureReason: error.message 
    });
  }
}
```

---

## Restart Persistence

### Scenario: Server Crashes Mid-Campaign

**Without persistence:**
```
❌ 1000 emails scheduled
❌ Server crashes after 100 sent
❌ All 1000 get re-sent on restart
❌ 100 duplicates delivered
```

**With our implementation:**
```
✅ 1000 emails scheduled
✅ BullMQ jobs stored in Redis (AOF enabled)
✅ Email status stored in PostgreSQL
✅ Server crashes after 100 sent
✅ Redis contains remaining 900 delayed jobs
✅ Database shows 100 with status='sent'
✅ Server restarts
✅ Worker reconnects to Redis
✅ Jobs resume automatically
✅ Worker checks DB status first
✅ 100 already-sent are skipped
✅ 900 pending are sent
✅ Zero duplicates
```

### Redis Persistence Configuration
```yaml
# docker-compose.yml
redis:
  command: redis-server --appendonly yes --appendfsync everysec
  volumes:
    - redis_data:/data
```

---

## Database Schema Relationships

```
User (1) ──< (N) EmailCampaign
User (1) ──< (N) Sender
User (1) ─── (1) SlackConnection

EmailCampaign (1) ──< (N) EmailJob
Sender (1) ──< (N) EmailJob
Sender (1) ──< (N) RateLimitLog

EmailCampaign ──> Sender (foreign key)
```

### Critical Indexes

```sql
-- Worker queries: fetch jobs ready to process
CREATE INDEX idx_emailjobs_status_scheduled 
ON email_jobs(status, scheduledAt);

-- Rate limit queries: count sent in hour window
CREATE INDEX idx_emailjobs_sender_sent 
ON email_jobs(senderId, sentAt);

-- Idempotency lookups
CREATE UNIQUE INDEX idx_emailjobs_idempotency 
ON email_jobs(idempotencyKey);

-- BullMQ correlation
CREATE UNIQUE INDEX idx_emailjobs_bulljobid 
ON email_jobs(bullJobId);
```

---

## Security Considerations

### Authentication
- Google OAuth 2.0 (no passwords stored)
- Express sessions stored in Redis
- CSRF protection via SameSite cookies
- httpOnly cookies in production

### Authorization
- All `/api/*` routes (except auth) require authentication
- Users can only access their own campaigns/emails
- Sender ownership verified on campaign creation

### Secrets Management
- All secrets in environment variables
- `.env` file gitignored
- `.env.example` provided as template
- No secrets in code or logs

### Rate Limiting (API level)
- Not yet implemented (future: express-rate-limit)
- Current: Per-sender email rate limiting only

---

## Scaling Considerations

### Current Implementation (Single Server)
- ✅ Handles ~200 emails/hour per sender
- ✅ Multiple senders can run concurrently
- ✅ Worker concurrency = 5 (configurable)
- ✅ Safe for ~1000 total emails/hour

### Horizontal Scaling (Future)
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Worker 1  │  │   Worker 2  │  │   Worker 3  │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        ▼
                ┌──────────────┐
                │ Redis Queue  │
                │  (Shared)    │
                └──────────────┘
```

**Requirements for multi-worker:**
- ✅ Already safe: Redis atomic rate limiting
- ✅ Already safe: Database idempotency checks
- ✅ Already safe: BullMQ distributed locking
- ⚠️ Need: Sticky sessions or JWT (current: Redis sessions OK)

---

## Monitoring & Observability

### Logs (Winston)
```
[2026-09-03 10:15:23] [info]: Worker processing job 12345
[2026-09-03 10:15:24] [info]: Email sent to user@example.com
[2026-09-03 10:15:24] [info]: Indexed in Elasticsearch
[2026-09-03 10:15:24] [warn]: Rate limit reached for sender@company.com
[2026-09-03 10:15:24] [info]: Slack notification sent
```

### Bull Board Dashboard
```
URL: http://localhost:5000/admin/queues

Shows:
- Waiting jobs (scheduled but not ready)
- Active jobs (currently processing)
- Completed jobs
- Failed jobs
- Delayed jobs (rate limited)
```

### Database Queries
```sql
-- Campaign progress
SELECT 
  status, 
  COUNT(*) as count 
FROM email_jobs 
WHERE campaignId = ?
GROUP BY status;

-- Sender rate limit status
SELECT 
  senderId,
  COUNT(*) as sent_this_hour
FROM email_jobs
WHERE sentAt >= DATE_TRUNC('hour', NOW())
GROUP BY senderId;
```

---

## Error Handling Strategy

### Layer 1: Input Validation (Zod)
```typescript
// Reject invalid requests immediately
campaignSchema.parse(request.body); // throws if invalid
```

### Layer 2: Business Logic Errors
```typescript
if (recipientCount === 0) {
  throw new AppError('No valid recipients', 400);
}
```

### Layer 3: External Service Failures
```typescript
try {
  await smtpTransporter.sendMail(message);
} catch (error) {
  logger.error('SMTP failed', error);
  // Update job status to 'failed'
  // Don't crash worker
}
```

### Layer 4: Express Error Handler
```typescript
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(err.statusCode || 500).json({
    error: err.message,
  });
});
```

---

## Development Workflow

### Local Development
```bash
# Terminal 1: Infrastructure
npm run docker:up

# Terminal 2: Backend API
npm run dev:backend

# Terminal 3: Worker
npm run dev:worker

# Terminal 4: Frontend
npm run dev:frontend
```

### Production Build
```bash
npm run build
npm run docker:up
npm start  # Starts backend API
npm run start:worker  # Starts worker (separate process/container)
```

---

## Testing Strategy

### Unit Tests (Vitest)
- ✅ Email parsing logic
- ✅ Scheduling calculation
- ✅ Idempotency key generation
- ✅ Rate limit calculation
- ✅ Input validation schemas

### Integration Tests (Future)
- API endpoint testing
- Database transaction testing
- Queue job processing

### End-to-End Tests (Future)
- Full campaign flow
- OAuth flow
- Slack notification flow

---

## Known Limitations & Future Work

### Current Limitations
1. **Hourly rate limit boundaries**: Emails can bunch at hour transitions
2. **No email templates**: Plain text/HTML only
3. **No retry logic**: Failed emails stay failed
4. **No campaign pause**: Once started, can't pause
5. **Single timezone**: All times in server timezone

### Roadmap
1. **Phase 2**: Campaign pause/resume, email retry
2. **Phase 3**: Template system, merge tags
3. **Phase 4**: Multi-timezone support
4. **Phase 5**: Analytics dashboard, open/click tracking
5. **Phase 6**: A/B testing, send-time optimization

---

**Document Version**: 1.0  
**Last Updated**: Checkpoint A Completion  
**Status**: Foundation Complete, Core Engine Next
