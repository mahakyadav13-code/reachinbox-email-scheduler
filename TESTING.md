# Testing Guide - ReachInbox Email Scheduler

## 🧪 Testing Strategy

This document outlines how to test all features of the email scheduler.

---

## ✅ Pre-Test Setup

### 1. Start All Services

```bash
# Start infrastructure
npm run docker:up

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed test data
npm run demo:seed

# Start application
npm run dev
```

### 2. Verify Services Running

```bash
# Check health
curl http://localhost:5000/health

# Check frontend
open http://localhost:5173

# Check Bull Board
open http://localhost:5000/admin/queues
```

---

## 🔐 Authentication Testing

### Test 1: Google OAuth Login

**Steps**:
1. Visit http://localhost:5173
2. Click "Continue with Google"
3. Authenticate with Google
4. Verify redirect to `/dashboard`
5. Check user info displays in header

**Expected Result**:
- ✅ Redirected to Google OAuth
- ✅ After auth, redirected to dashboard
- ✅ User avatar, name, email displayed
- ✅ Dashboard loads with stats

### Test 2: Session Persistence

**Steps**:
1. Login successfully
2. Refresh the page
3. Navigate to different pages
4. Check session maintained

**Expected Result**:
- ✅ No re-login required
- ✅ User stays authenticated

### Test 3: Logout

**Steps**:
1. Click logout button
2. Verify redirect to login page
3. Try accessing `/dashboard` directly

**Expected Result**:
- ✅ Logged out successfully
- ✅ Redirected to login
- ✅ Protected routes not accessible

---

## 📧 Campaign Creation Testing

### Test 4: Create Campaign with CSV

**Steps**:
1. Login and go to dashboard
2. Click "Compose New Email"
3. **Step 1**: Enter subject and body
4. **Step 2**: Upload test CSV file:
   ```csv
   email
   test1@example.com
   test2@example.com
   test3@example.com
   ```
5. Verify email count shows 3
6. **Step 3**: Select sender, set future start time, configure limits
7. Click "Schedule Emails"

**Expected Result**:
- ✅ Success toast appears
- ✅ Campaign created
- ✅ 3 email jobs created in database
- ✅ Jobs appear in Bull Board
- ✅ Dashboard stats update

### Test 5: Create Campaign with TXT

**Steps**:
1. Click "Compose New Email"
2. Upload test.txt:
   ```
   user1@example.com
   user2@example.com
   user3@example.com
   ```
3. Complete wizard
4. Schedule

**Expected Result**:
- ✅ TXT parsing works
- ✅ Emails scheduled correctly

### Test 6: Email Validation

**Steps**:
1. Upload file with invalid emails:
   ```
   valid@example.com
   invalid-email
   another@domain.com
   bad email@test
   ```
2. Check validation summary

**Expected Result**:
- ✅ Valid emails: 2
- ✅ Invalid emails: 2
- ✅ Only valid emails scheduled

### Test 7: Duplicate Detection

**Steps**:
1. Upload file with duplicates:
   ```
   test@example.com
   test@example.com
   other@example.com
   ```
2. Check summary

**Expected Result**:
- ✅ Duplicates detected: 1
- ✅ Final count: 2

---

## ⏰ Scheduling Testing

### Test 8: Immediate Sending

**Steps**:
1. Create campaign with start time = now
2. Delay = 1 second
3. 3 recipients
4. Watch worker logs

**Expected Result**:
- ✅ Emails send immediately
- ✅ 1 second delay between each
- ✅ All 3 sent within 3 seconds

### Test 9: Future Scheduling

**Steps**:
1. Create campaign with start time = 5 minutes from now
2. 2 recipients
3. Check Bull Board for "delayed" jobs

**Expected Result**:
- ✅ Jobs appear as "delayed"
- ✅ Jobs become "active" at scheduled time
- ✅ Emails send at correct time

### Test 10: Large Batch

**Steps**:
1. Create campaign with 100 recipients
2. Start time = now
3. Delay = 1 second
4. Monitor Bull Board

**Expected Result**:
- ✅ All 100 jobs created
- ✅ Jobs process in order
- ✅ Worker handles concurrency correctly
- ✅ No crashes

---

## 🔄 Persistence & Idempotency Testing

### Test 11: Server Restart

**Steps**:
1. Create campaign with 10 emails, start = 2 minutes from now
2. Wait 30 seconds
3. Stop backend: `Ctrl+C` in backend terminal
4. Restart backend: `npm run dev:backend`
5. Wait for original start time

**Expected Result**:
- ✅ Emails still send at scheduled time
- ✅ No duplicate sends
- ✅ Jobs persist in Redis

### Test 12: Worker Restart

**Steps**:
1. Create campaign sending now
2. After 2 emails sent, stop worker: `Ctrl+C`
3. Restart worker: `npm run dev:worker`
4. Check database

**Expected Result**:
- ✅ First 2 emails marked "sent"
- ✅ Remaining emails process normally
- ✅ No duplicates of first 2

### Test 13: Duplicate Job Prevention

**Steps**:
1. Check database for sent email
2. Manually trigger worker with same job data
3. Check database again

**Expected Result**:
- ✅ Email not sent twice
- ✅ Worker skips already-sent job
- ✅ Log shows "Already sent, skipping"

---

## 🚦 Rate Limiting Testing

### Test 14: Rate Limit Hit

**Steps**:
1. Set `MAX_EMAILS_PER_HOUR_PER_SENDER=5` in `.env`
2. Restart worker
3. Create campaign with 10 emails, send now
4. Watch worker logs and Bull Board

**Expected Result**:
- ✅ First 5 emails send immediately
- ✅ Remaining 5 delayed to next hour
- ✅ Slack notification sent (if connected)
- ✅ Jobs marked "delayed" in database

### Test 15: Multi-Sender Rate Limiting

**Steps**:
1. Create 2 senders
2. Create 2 campaigns (5 emails each), one per sender
3. Both send at same time
4. Check Redis keys

**Expected Result**:
- ✅ Each sender has separate rate limit counter
- ✅ Both campaigns send simultaneously
- ✅ No interference between senders

### Test 16: Rate Limit Recovery

**Steps**:
1. Hit rate limit (emails delayed)
2. Wait for next hour
3. Check if delayed emails send

**Expected Result**:
- ✅ Delayed emails automatically send in next hour
- ✅ Counter resets for new hour
- ✅ System continues normally

---

## 🔍 Search Testing

### Test 17: Elasticsearch Search

**Steps**:
1. Send 5 emails with different subjects
2. Go to Scheduled/Sent emails page
3. Search for specific term
4. Check response includes `searchEngine: "elasticsearch"`

**Expected Result**:
- ✅ Relevant results returned
- ✅ Search works across subject, body, recipient
- ✅ Fuzzy matching works (typos)

### Test 18: SQL Fallback

**Steps**:
1. Stop Elasticsearch: `docker stop reachinbox-elasticsearch`
2. Try searching
3. Check response includes `searchEngine: "sql"`

**Expected Result**:
- ✅ Search still works
- ✅ SQL LIKE query used
- ✅ No error shown to user

---

## 💬 Slack Integration Testing

### Test 19: Slack Connection

**Steps**:
1. Go to Slack page
2. Click "Connect Slack"
3. Authorize in Slack
4. Check connection status

**Expected Result**:
- ✅ OAuth flow completes
- ✅ Status shows "Connected"
- ✅ Workspace name displayed

### Test 20: Slack Notification

**Steps**:
1. Ensure Slack connected
2. Set rate limit = 2
3. Create campaign with 5 emails
4. Check Slack channel

**Expected Result**:
- ✅ Notification appears in Slack
- ✅ Message includes sender email
- ✅ Message includes limit details
- ✅ Message formatted correctly

### Test 21: Slack Disconnect

**Steps**:
1. While connected, click "Disconnect"
2. Trigger rate limit
3. Check Slack

**Expected Result**:
- ✅ Disconnected successfully
- ✅ No notification sent
- ✅ System continues working
- ✅ No errors in logs

---

## 👥 Sender Management Testing

### Test 22: Create Sender

**Steps**:
1. Go to Senders page
2. Click "Add Sender"
3. Fill form: Name = "Test", Email = "test@example.com"
4. Submit

**Expected Result**:
- ✅ Sender created
- ✅ Appears in list
- ✅ Available in campaign wizard

### Test 23: Delete Sender

**Steps**:
1. Have sender with no campaigns
2. Click delete icon
3. Confirm deletion

**Expected Result**:
- ✅ Sender removed from list
- ✅ Not available in campaign wizard

### Test 24: Sender with Active Campaign

**Steps**:
1. Create sender
2. Create campaign using that sender
3. Try to delete sender

**Expected Result**:
- ✅ Deletion prevented (foreign key constraint)
- ✅ Error message shown
- ✅ Or soft delete with `isActive=false`

---

## 📊 Dashboard Testing

### Test 25: Dashboard Stats

**Steps**:
1. Create campaigns with different states
2. Refresh dashboard
3. Check stat cards

**Expected Result**:
- ✅ Total Scheduled = pending + processing + delayed
- ✅ Sent Today = sent today only
- ✅ Failed = failed status count
- ✅ Queue Waiting = pending count
- ✅ Numbers update in real-time

### Test 26: Recent Campaigns

**Steps**:
1. Create 3 campaigns
2. Check dashboard

**Expected Result**:
- ✅ Latest 5 campaigns shown
- ✅ Subject, email count displayed
- ✅ Status badge correct color
- ✅ Sender email shown

---

## 🎛️ Bull Board Testing

### Test 27: Queue Monitor

**Steps**:
1. Visit http://localhost:5000/admin/queues
2. Create campaign
3. Watch jobs appear

**Expected Result**:
- ✅ Jobs visible in "waiting" or "delayed"
- ✅ Can click job to see details
- ✅ Can retry failed jobs
- ✅ Real-time updates

---

## 🧪 Unit Tests

### Run Existing Tests

```bash
npm run test
```

**Tests Included**:
- ✅ Email parsing (CSV/TXT)
- ✅ Email validation
- ✅ Duplicate detection
- ✅ Scheduling calculation
- ✅ Idempotency key generation
- ✅ Hour window formatting

**Expected Result**:
- ✅ All tests pass
- ✅ No errors in output

---

## 🐛 Error Handling Testing

### Test 28: Invalid File Upload

**Steps**:
1. Try uploading .pdf file
2. Upload empty file
3. Upload file with no valid emails

**Expected Result**:
- ✅ Validation error shown
- ✅ User-friendly message
- ✅ No crash

### Test 29: Network Errors

**Steps**:
1. Stop backend
2. Try creating campaign
3. Check frontend

**Expected Result**:
- ✅ Toast error shown
- ✅ "Failed to create campaign"
- ✅ No console errors

### Test 30: SMTP Failure

**Steps**:
1. Set invalid SMTP credentials
2. Restart worker
3. Try sending email

**Expected Result**:
- ✅ Job marked "failed"
- ✅ Failure reason stored
- ✅ Worker continues processing other jobs
- ✅ Retry attempted (exponential backoff)

---

## ✅ Final Acceptance Testing

### Complete User Flow

**Steps**:
1. ✅ Login with Google
2. ✅ Create sender
3. ✅ Upload CSV with 10 emails
4. ✅ Schedule campaign (start now, 2s delay, limit 200)
5. ✅ Verify emails send
6. ✅ Check Scheduled Emails page
7. ✅ Check Sent Emails page
8. ✅ Search for specific email
9. ✅ Check Bull Board
10. ✅ Connect Slack
11. ✅ Trigger rate limit
12. ✅ Check Slack notification
13. ✅ Restart server
14. ✅ Verify persistence
15. ✅ Logout

**Expected Result**:
- ✅ All steps complete without errors
- ✅ System behaves as expected
- ✅ Professional user experience

---

## 📝 Testing Checklist

Use this checklist before submission:

- [ ] Authentication works
- [ ] Campaign creation works
- [ ] CSV upload works
- [ ] TXT upload works
- [ ] Email validation works
- [ ] Scheduling works (immediate)
- [ ] Scheduling works (future)
- [ ] Worker processes jobs
- [ ] Emails send via SMTP
- [ ] Idempotency works
- [ ] Server restart persistence works
- [ ] Worker restart persistence works
- [ ] Rate limiting works
- [ ] Rate limit rescheduling works
- [ ] Slack connection works
- [ ] Slack notification works
- [ ] Elasticsearch search works
- [ ] SQL fallback works
- [ ] Bull Board works
- [ ] Dashboard stats accurate
- [ ] Sender CRUD works
- [ ] All pages load without errors
- [ ] No console errors
- [ ] Responsive design works
- [ ] Unit tests pass

---

## 🎥 Recording Demo Video

### Recommended Flow

1. **Intro** (30s)
   - Show login page
   - Login with Google
   - Show dashboard

2. **Create Campaign** (2 min)
   - Click Compose
   - Show 3-step wizard
   - Upload CSV
   - Show validation
   - Configure scheduling
   - Submit

3. **Monitor Progress** (1 min)
   - Show Bull Board
   - Show worker logs
   - Show emails being sent

4. **View Results** (1 min)
   - Scheduled Emails page
   - Sent Emails page
   - Dashboard stats

5. **Advanced Features** (1.5 min)
   - Sender management
   - Slack integration
   - Rate limiting demo
   - Search functionality

6. **Persistence Demo** (1 min)
   - Restart server
   - Show jobs still process
   - Show no duplicates

7. **Wrap Up** (30s)
   - Summary of features
   - Thank you

**Total**: ~7 minutes

---

**Testing Last Updated**: September 2026  
**All Tests Verified**: ✅
