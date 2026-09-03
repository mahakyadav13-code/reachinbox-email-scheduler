# ReachInbox Email Scheduler

A full-stack email scheduling service: an Express + TypeScript API, a BullMQ worker backed by Redis, PostgreSQL for state, and a React dashboard. Emails are scheduled as BullMQ **delayed jobs** — there is no cron anywhere in the system.

Built as the ReachInbox / Outbox Labs Software Development Intern assignment.

---

## Contents

- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Setting up Ethereal Email](#setting-up-ethereal-email)
- [Running the pieces individually](#running-the-pieces-individually)
- [Architecture](#architecture)
  - [How scheduling works](#how-scheduling-works)
  - [How persistence across restarts works](#how-persistence-across-restarts-works)
  - [How idempotency works](#how-idempotency-works)
  - [How rate limiting and concurrency work](#how-rate-limiting-and-concurrency-work)
  - [Behaviour under load](#behaviour-under-load)
- [Feature checklist](#feature-checklist)
- [API reference](#api-reference)
- [Testing](#testing)
- [Assumptions and trade-offs](#assumptions-and-trade-offs)

---

## Quick start

**Prerequisites:** Node.js 18+, Docker Desktop, a Google OAuth client, an Ethereal account.

```bash
# 1. Install
npm install

# 2. Start PostgreSQL, Redis and Elasticsearch
npm run docker:up

# 3. Configure
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
# then fill in the values described below

# 4. Create the schema and seed a sender
npm run prisma:generate
npm run prisma:migrate
npm run demo:seed

# 5. Start API + worker + frontend together
npm run dev
```

### Running without Docker (Windows + WSL)

If Docker isn't available, the same three services can run natively: PostgreSQL
on Windows, Redis and Elasticsearch inside WSL. Use `npm run dev:wsl` instead of
`npm run dev` — it starts both WSL services, waits for them to answer, and holds
the WSL VM open for as long as the dev servers run.

```powershell
# One-time: install the two services inside WSL
wsl -d Ubuntu -u root bash -c "apt-get update -y && apt-get install -y redis-server"
wsl -d Ubuntu -u root bash -c "sed -i 's/^appendonly no/appendonly yes/;s/^bind 127.0.0.1 -::1/bind 0.0.0.0/;s/^protected-mode yes/protected-mode no/' /etc/redis/redis.conf"

# Elasticsearch 8.11 from the Elastic apt repo, security disabled for local dev
wsl -d Ubuntu -u root bash -c "apt-get install -y apt-transport-https gnupg curl"
wsl -d Ubuntu -u root bash -c "curl -fsSL https://artifacts.elastic.co/GPG-KEY-elasticsearch | gpg --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg"
wsl -d Ubuntu -u root bash -c "echo 'deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] https://artifacts.elastic.co/packages/8.x/apt stable main' > /etc/apt/sources.list.d/elastic-8.x.list && apt-get update -y && apt-get install -y elasticsearch=8.11.0"

# One-time: enable systemd so both services start with the distro
wsl -d Ubuntu -u root bash -c "printf '[boot]\nsystemd=true\n' > /etc/wsl.conf"
wsl --shutdown
wsl -d Ubuntu -u root bash -c "systemctl enable redis-server elasticsearch"

# Then, every time:
npm run dev:wsl
```

Two environment details matter on this setup:

- **`%USERPROFILE%\.wslconfig` needs `networkingMode=mirrored`** under `[wsl2]`.
  Without it, WSL runs behind NAT and the Hyper-V firewall's default inbound
  action (`Block`) stops Windows from reaching Redis and Elasticsearch. Mirrored
  mode shares the host network stack, so plain `localhost` works.
- **WSL shuts its VM down once no session is attached**, taking both services
  with it. `npm run dev:wsl` holds a session open; `npm run infra:up` on its own
  only starts and health-checks them.

Elasticsearch needs 2–3 minutes for a cold boot and about 1 GB of RAM with the
512 MB heap configured in `jvm.options.d/heap.options`. While it is still
starting the backend logs a warning and serves search from the SQL fallback,
upgrading itself automatically once the cluster answers.

| Service | URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| API | http://localhost:5000 |
| Bull Board (queue dashboard) | http://localhost:5000/admin/queues |
| Health check | http://localhost:5000/health |

Bull Board requires a signed-in session — log in through the frontend first, then open it in the same browser. Set `QUEUE_DASHBOARD_TOKEN` and append `?token=...` if you need to reach it without logging in.

---

## Environment variables

All backend configuration lives in `apps/backend/.env`. Nothing operational is hardcoded.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` | Redis, used by BullMQ, rate limit counters and sessions |
| `ELASTICSEARCH_NODE` | `http://localhost:9200` | Search cluster; falls back to SQL if unreachable |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | — | Google OAuth login |
| `SESSION_SECRET` / `JWT_SECRET` | — | Session signing. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `QUEUE_DASHBOARD_TOKEN` | empty | Optional token for Bull Board access without a session |
| `ETHEREAL_HOST` / `ETHEREAL_PORT` / `ETHEREAL_USER` / `ETHEREAL_PASS` | `smtp.ethereal.email` / `587` | Fake SMTP credentials |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` / `SLACK_REDIRECT_URI` | — | Slack OAuth for rate-limit alerts |
| **`WORKER_CONCURRENCY`** | `5` | How many emails the worker sends in parallel |
| **`MAX_EMAILS_PER_HOUR_PER_SENDER`** | `200` | Hard ceiling on sends per sender per hour |
| **`MIN_DELAY_BETWEEN_EMAILS_SECONDS`** | `2` | Minimum gap between two sends |
| `FRONTEND_URL` / `BACKEND_URL` | `:5173` / `:5000` | Used for OAuth redirects and CORS |
| `PORT` | `5000` | API port |

The frontend only needs `VITE_API_URL` (default `http://localhost:5000`).

### The delay we chose

**Minimum 2 seconds between individual sends**, set by `MIN_DELAY_BETWEEN_EMAILS_SECONDS`.

This is enforced in two places:

1. **At schedule time.** A campaign's requested `delayBetweenEmails` is clamped upward to this floor, so a caller can ask for a wider gap but never a narrower one — including via the API directly.
2. **At the worker.** The BullMQ limiter is configured as `max: WORKER_CONCURRENCY per MIN_DELAY_BETWEEN_EMAILS_SECONDS`, which caps burst throughput when a large backlog of already-due jobs is drained at once (for example after a restart).

---

## Setting up Ethereal Email

1. Go to https://ethereal.email/ and press **Create Ethereal Account**.
2. Copy the generated username and password into `ETHEREAL_USER` and `ETHEREAL_PASS`.
3. Nothing is delivered to real inboxes. Every send is logged with a preview URL:
   ```
   info: Email sent: <abc@ethereal.email>
   info: Preview URL: https://ethereal.email/message/XYZ...
   ```
   Open that URL, or sign in at ethereal.email, to read the message.

Senders are rows in the `senders` table (`npm run demo:seed` creates two). All of them relay through the single Ethereal mailbox, but each carries its own From name/address and its own independent hourly rate-limit budget.

---

## Running the pieces individually

```bash
npm run dev:backend    # API only        (tsx watch src/server.ts)
npm run dev:worker     # Worker only     (tsx watch src/worker.ts)
npm run dev:frontend   # Vite dev server
npm run build          # Type-check and compile both apps
npm run test           # Backend unit tests
```

The API and the worker are **separate processes**. The API only enqueues; the worker only sends. Either can be restarted, or the worker scaled to several instances, without losing or duplicating jobs.

---

## Architecture

```
                  ┌───────────────┐
   Browser ─────► │  Express API  │ ──► PostgreSQL   (campaigns, jobs, status)
   (React)        └───────┬───────┘
                          │ addBulk (delayed jobs)
                          ▼
                  ┌───────────────┐
                  │ Redis / BullMQ│  delayed set + rate limit counters + sessions
                  └───────┬───────┘
                          │ reserved by concurrency N
                          ▼
                  ┌───────────────┐     ┌──────────────────┐
                  │    Worker     │ ──► │ Ethereal (SMTP)  │
                  │  (own process)│ ──► │ Elasticsearch    │
                  └───────┬───────┘     │ Slack            │
                          │             └──────────────────┘
                          └──► PostgreSQL (status transitions)
```

Backend layering is `routes → middleware (auth, zod validation) → controllers → services → repositories → Prisma`. External systems are isolated behind `src/integrations/`.

### How scheduling works

Creating a campaign (`POST /api/campaigns`):

1. Verify the sender belongs to the caller.
2. Parse the uploaded CSV/TXT. The parser detects a header row, resolves which column holds addresses, validates, and de-duplicates. Invalid rows are reported back rather than silently dropped.
3. Clamp `delayBetweenEmails` up to `MIN_DELAY_BETWEEN_EMAILS_SECONDS`.
4. Compute a send time per recipient:
   ```
   scheduledAt[i] = startTime + (i × delayBetweenEmails)
   ```
5. Insert all `email_jobs` rows in one `createMany`.
6. Enqueue all jobs with `queue.addBulk` in chunks of 500, each with `delay = scheduledAt − now` and a deterministic `jobId`.
7. Bulk-index the jobs into Elasticsearch so **scheduled** email is searchable immediately, not only after sending.

BullMQ holds the job in its delayed set and moves it to the wait list when the delay elapses. There is no polling loop and no cron.

### How persistence across restarts works

Nothing that matters lives in process memory.

- **The schedule** is in Redis' delayed set. Redis runs with AOF enabled (`--appendonly yes --appendfsync everysec`), so the delayed set survives a Redis restart too.
- **The truth about each email** is a row in `email_jobs` with a status of `pending → processing → sent | failed | delayed`.
- **On restart the API does not re-enqueue anything.** Re-enqueueing is exactly what would cause duplicates. The jobs are already in Redis; the worker reconnects and keeps draining them.
- Jobs whose time passed while the process was down are due immediately on reconnect, and the worker's limiter paces them out instead of firing them all at once.

To verify: schedule something a few minutes out, kill the worker (`Ctrl+C`), watch the Delayed count hold steady in Bull Board, restart, and it sends at the original time.

### How idempotency works

Three layers, because the hard constraint is that an email is never sent twice.

1. **Deterministic identity.** `idempotencyKey = sha256(campaignId : recipientEmail : scheduledAt)`, unique-constrained in PostgreSQL, and the BullMQ `jobId` is derived from it. BullMQ silently ignores an add for an id already present, so retrying the enqueue step cannot create a second copy. Rescheduled jobs use `…-w<targetTimestamp>`, which is likewise derived, not random.
2. **Atomic claim.** Before sending, the worker performs a conditional update:
   ```ts
   updateMany({ where: { idempotencyKey, status: { in: ['pending','delayed'] } },
                data:  { status: 'processing' } })
   ```
   Exactly one worker can observe `count === 1`. Any other worker sees `0` and returns without sending. A read-then-write check would leave a race window here; this does not.
3. **Terminal-state short-circuit.** A job already marked `sent` returns immediately.

A worker that claims a job and then fails releases its rate-limit reservation and hands the job back to BullMQ's retry policy (3 attempts, exponential backoff from 2s).

### How rate limiting and concurrency work

**Concurrency** is `WORKER_CONCURRENCY` (default 5) jobs in flight per worker process. Everything shared between them — the rate limit counter, the job claim — is guarded by an atomic operation in Redis or PostgreSQL, so raising it (or running several worker processes) is safe.

**The hourly limit** is enforced per sender, in Redis, keyed by sender and hour window:

```
rate_limit:{senderId}:{YYYY-MM-DD-HH}
```

The effective limit for a send is `min(campaign.hourlyLimit, MAX_EMAILS_PER_HOUR_PER_SENDER)` — a campaign may request a tighter limit from the compose form, but the env value remains an authoritative ceiling.

A send reserves its slot with a single `INCR`:

- result `<=` limit → permitted;
- result `>` limit → immediately `DECR`'d back and the send is refused.

Rolling the reservation back matters: it keeps the counter equal to the number of sends actually permitted, instead of inflating on every blocked attempt. The key carries a 2-hour TTL, so windows expire on their own. Counters are never held in memory, so the limit holds across workers and across restarts.

**When the limit is hit, nothing is dropped or failed.** The job is:

1. marked `delayed` in PostgreSQL, with `scheduledAt` updated to its new time;
2. given an order-preserving position via `INCR reschedule_seq:{senderId}:{nextWindow}`;
3. re-queued for `nextWindow + (position − 1) × spacing`, where
   `spacing = max(MIN_DELAY_BETWEEN_EMAILS_SECONDS, 3600 / effectiveLimit)`.

The sequence counter is what preserves order: the first email rejected is the first one sent next hour. The spacing is what stops the whole rejected batch from stampeding the window boundary and instantly re-hitting the limit — spreading a 200/hour budget over 18-second gaps fills the window almost exactly.

**Slack notification.** The moment a sender's limit is reached, the connected workspace gets a message naming the sender, the limit, the window and when sending resumes. `SET NX` on `rate_limit_notified:{senderId}:{window}` claims the right to notify, so a 1000-email backlog produces **one** message rather than 800. If the user has not connected Slack the notification is skipped silently; connecting later starts notifications working with no redeploy, because the token is read from the database on each send.

### Behaviour under load

**1000 emails scheduled for roughly the same time, limit 200/hour:**

| Hour | What happens |
| --- | --- |
| 1 | 200 sends permitted, paced ≥2s apart. Email 201 trips the limit → one Slack alert. Emails 201–1000 are stamped `delayed` with sequence numbers and spread across hour 2 at 18s intervals. |
| 2 | The first 200 of those (in original order) send. The remainder roll forward the same way. |
| 3–5 | Drains until empty. |

Properties that hold throughout: nothing is dropped, nothing is sent twice, relative order is preserved, memory use is flat (state is in Redis and PostgreSQL, not in the process), and the enqueue path is one bulk pipeline rather than 1000 round trips.

---

## Feature checklist

**Backend**

| | Feature |
| --- | --- |
| ✅ | Email scheduling API with zod validation |
| ✅ | Jobs stored in PostgreSQL via Prisma |
| ✅ | BullMQ delayed jobs — no cron, no `node-cron`, no `agenda` |
| ✅ | Multiple senders, each with its own rate-limit budget |
| ✅ | Sending via Ethereal SMTP with preview URLs |
| ✅ | Restart-safe: delays in Redis (AOF), status in PostgreSQL, no re-enqueue on boot |
| ✅ | Idempotency: deterministic keys + atomic claim + unique constraint |
| ✅ | Configurable worker concurrency |
| ✅ | Minimum delay between sends, enforced at schedule time and in the worker limiter |
| ✅ | Per-sender hourly rate limit with Redis counters, safe across workers |
| ✅ | Order-preserving reschedule into the next window instead of dropping |
| ✅ | Slack OAuth + one live alert per sender per window |
| ✅ | Elasticsearch indexing of scheduled and sent email, with SQL fallback |
| ✅ | Bull Board dashboard, session-protected |
| ✅ | Google OAuth with Redis-backed sessions |

**Frontend**

| | Feature |
| --- | --- |
| ✅ | Google login (real OAuth, no mock) |
| ✅ | Header with name, email, avatar and logout |
| ✅ | Dashboard with live stats |
| ✅ | Compose wizard: subject, body, CSV/TXT upload with valid/invalid/duplicate counts, start time, delay, hourly limit |
| ✅ | Scheduled emails table: recipient, subject, sender, time, status |
| ✅ | Sent emails table with `sent` / `failed` status |
| ✅ | Debounced search across recipient, subject and body |
| ✅ | Queue monitor with live counters |
| ✅ | Slack connect / disconnect page |
| ✅ | Loading skeletons, empty states, error toasts |
| ✅ | Protected routes, reusable UI primitives, typed API layer |

---

## API reference

```
GET    /health                        Liveness probe

GET    /api/auth/google               Start Google OAuth
GET    /api/auth/google/callback      OAuth callback → redirects to dashboard
GET    /api/auth/me                   Current user
POST   /api/auth/logout               Destroy session

POST   /api/campaigns                 Create + schedule a campaign
GET    /api/campaigns                 List campaigns (paginated)
GET    /api/campaigns/:id             Campaign detail + per-status counts

GET    /api/emails/scheduled          pending | processing | delayed
GET    /api/emails/sent               sent | failed
GET    /api/emails/search?q=          Elasticsearch, SQL fallback
GET    /api/emails/stats              Dashboard counters
GET    /api/emails/queue-stats        Live BullMQ counters

GET    /api/senders                   List senders
POST   /api/senders                   Create sender
DELETE /api/senders/:id               Delete sender

GET    /api/slack/connect             Start Slack OAuth
GET    /api/slack/callback            OAuth callback
GET    /api/slack/status              Connection status
DELETE /api/slack/disconnect          Remove connection

GET    /admin/queues                  Bull Board (requires session)
```

Everything under `/api` except the auth entry points requires an authenticated session.

### Example: schedule a campaign

```bash
curl -X POST http://localhost:5000/api/campaigns \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{
    "senderId": "<sender-id>",
    "subject": "Quick question",
    "body": "Hi there — are you the right person to talk to about this?",
    "recipients": "email\nalice@example.com\nbob@example.com",
    "fileType": "csv",
    "startTime": "2026-09-03T10:00:00.000Z",
    "delayBetweenEmails": 2,
    "hourlyLimit": 200
  }'
```

---

## Testing

### Unit tests

```bash
npm run test
```

Covers the scheduling maths (send-time spread, delay-from-now, hour-window maths), idempotency key determinism and reschedule-id stability, and CSV/TXT parsing including headers, invalid rows and duplicates.

### Verification scripts

Three scripts exercise the running system rather than mocks. Each reuses a live
browser session from Redis, so sign in through the app first.

```bash
npm run verify:api          # every endpoint returns the { data } envelope the SPA reads
npm run smoke:e2e           # full campaign through the API, with a deliberate rate-limit breach
npm run verify:persistence  # snapshot of the delayed set, run before and after a restart
```

`smoke:e2e [recipients] [hourlyLimit]` schedules a batch with a low hourly limit
so the limiter trips mid-campaign, then asserts the outcome:

```
$ npm run smoke:e2e 5 3

  [05:44:10] pending=5
  [05:44:16] processing=1  pending=4
  [05:44:22] processing=2  sent=1  delayed=1  pending=1
  [05:44:25] sent=3  delayed=2

PASS  Jobs persisted                         5/5
PASS  Sent up to the limit                   3 sent
PASS  Overflow rescheduled, not failed       2 delayed, 0 failed
PASS  Rescheduled jobs are ordered/spaced    2 times, strictly increasing
PASS  Rate limit counter exists              rate_limit:<sender>:2026-09-03-05
PASS  Slack notified once per window         1 notify marker(s)
PASS  Reschedule sequence used               reschedule_seq:<sender>:2026-09-03-06
PASS  Indexed in Elasticsearch               5 docs

8/8 checks passed.
```

The two capped messages then delivered in their assigned slots in the next
window, 20 minutes apart (`3600 / 3` seconds), in the order they were rejected —
and survived a full restart of the API, worker and Redis in between:

```
 recipient             | status | scheduled | sent
----------------------+--------+-----------+---------
 smoke-02@example.com | sent   | 00:14:17  | 00:14:21
 smoke-01@example.com | sent   | 00:14:15  | 00:14:23
 smoke-03@example.com | sent   | 00:14:19  | 00:14:23
 smoke-04@example.com | sent   | 00:30:00  | 00:30:05   <- next window
 smoke-05@example.com | sent   | 00:50:00  | 00:50:03   <- next window
```

`verify:persistence` is the restart proof. Run it, stop the API and worker, start
them again, and run it a second time: the delayed job IDs and their due
timestamps are unchanged, and `duplicate sends` stays at `none`.

---

## Assumptions and trade-offs

**Assumptions**

- All senders relay through one Ethereal mailbox. Senders are distinct identities with independent rate-limit budgets, which is what the scheduler cares about; wiring per-sender SMTP credentials would be a config change, not a design change.
- Hour windows follow the server's local clock, not per-user timezones.
- A campaign's `hourlyLimit` is treated as a request for something tighter than the deployment ceiling, never looser.
- One Slack workspace per user.

**Trade-offs**

- **Rate limiting is Redis counters, not BullMQ's limiter.** BullMQ's limiter is queue-wide; the requirement is per sender. Counters keyed by sender and hour window give exactly that, and let a blocked job be rescheduled with a real target time rather than just being deferred. The worker limiter is still used, as a burst ceiling.
- **`INCR` then roll back, rather than a Lua script.** Slightly more chatter against Redis, meaningfully simpler to read. Under contention the reservation may be briefly held and released; it never permits an over-send.
- **Fail open on Redis errors.** If the counter cannot be read, the send proceeds. For cold outreach, a brief over-send beats a stalled queue. Inverting this is a one-line change.
- **Rescheduling is per job, not per batch.** Each rejected email schedules itself individually, which keeps the worker stateless at the cost of one Redis `INCR` per rejection.
- **Search degrades rather than failing.** If Elasticsearch is unreachable, search falls back to SQL `ILIKE` and the response reports which engine served it. Connection attempts retry on a 30-second cooldown, so search upgrades itself once the cluster is up.
- **Indexing is fire-and-forget.** A search-index failure is logged and never blocks a send or a schedule. The database stays the source of truth.
- **Failed sends retry 3 times with exponential backoff, then stop.** No dead-letter queue; failures are visible in the Sent tab with their reason, and in Bull Board.

**Not implemented**

- Campaign pause/resume/cancel.
- Per-recipient template variables.
- Open and click tracking.
- Dead-letter queue and replay tooling.

---

## Troubleshooting

**Docker services won't start**
```bash
docker compose down -v && docker compose up -d
```

**Elasticsearch takes a while to become healthy.** That is expected — the app starts on the SQL fallback and switches to Elasticsearch automatically once the cluster answers. `docker compose ps` shows its health.

**`prisma migrate` errors**
```bash
npx prisma migrate reset   # destroys local data
npm run prisma:migrate
```

**Bull Board redirects to Google.** That is the auth guard. Sign in via the frontend first, or set `QUEUE_DASHBOARD_TOKEN` and use `?token=...`.
