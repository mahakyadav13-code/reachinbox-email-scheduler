# Deployment Guide - ReachInbox Email Scheduler

## 🚀 Production Deployment Checklist

### Prerequisites
- [ ] Docker/Docker Compose installed on server
- [ ] Domain name configured (optional)
- [ ] SSL certificates ready (Let's Encrypt recommended)
- [ ] Google OAuth credentials for production domain
- [ ] Slack app credentials (optional)
- [ ] SMTP credentials (Ethereal for demo, real SMTP for production)

---

## 📋 Pre-Deployment Steps

### 1. Environment Configuration

Create production `.env` files:

```bash
# Backend production environment
cp apps/backend/.env.example apps/backend/.env.production
```

**Critical Production Values**:
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@postgres:5432/reachinbox_prod
REDIS_HOST=redis
REDIS_PORT=6379
ELASTICSEARCH_NODE=http://elasticsearch:9200

# Use production URLs
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback
SLACK_REDIRECT_URI=https://api.yourdomain.com/api/slack/callback

# Strong random secrets (generate with: openssl rand -hex 32)
SESSION_SECRET=<strong-random-secret-here>
JWT_SECRET=<different-strong-secret-here>

# Production SMTP (replace Ethereal)
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password

# Rate limiting (adjust based on your needs)
WORKER_CONCURRENCY=10
MAX_EMAILS_PER_HOUR_PER_SENDER=500
MIN_DELAY_BETWEEN_EMAILS_SECONDS=1
```

### 2. Build for Production

```bash
# Build backend
cd apps/backend
npm run build

# Build frontend
cd apps/frontend
npm run build
```

### 3. Database Migrations

```bash
# Run migrations in production
npm run prisma:migrate deploy
```

---

## 🐳 Docker Deployment

### Option 1: Docker Compose (Recommended for VPS)

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: reachinbox
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: reachinbox_prod
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
    networks:
      - reachinbox-network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --appendfsync everysec
    volumes:
      - redis_prod_data:/data
    networks:
      - reachinbox-network
    restart: unless-stopped

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms1g -Xmx1g"
    volumes:
      - es_prod_data:/usr/share/elasticsearch/data
    networks:
      - reachinbox-network
    restart: unless-stopped

  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    env_file:
      - ./apps/backend/.env.production
    ports:
      - "5000:5000"
    depends_on:
      - postgres
      - redis
      - elasticsearch
    networks:
      - reachinbox-network
    restart: unless-stopped

  worker:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile.worker
    env_file:
      - ./apps/backend/.env.production
    depends_on:
      - postgres
      - redis
      - elasticsearch
    networks:
      - reachinbox-network
    restart: unless-stopped

  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile
    environment:
      - VITE_API_URL=https://api.yourdomain.com
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - reachinbox-network
    restart: unless-stopped

volumes:
  postgres_prod_data:
  redis_prod_data:
  es_prod_data:

networks:
  reachinbox-network:
    driver: bridge
```

**Deploy**:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🔐 Security Hardening

### 1. Environment Variables
- ✅ Never commit `.env` files
- ✅ Use strong random secrets (minimum 32 characters)
- ✅ Rotate secrets periodically
- ✅ Use different secrets for each environment

### 2. Database Security
- ✅ Change default PostgreSQL password
- ✅ Restrict PostgreSQL to local network only
- ✅ Enable SSL for database connections in production
- ✅ Regular backups with pg_dump

### 3. Redis Security
- ✅ Enable Redis AUTH password
- ✅ Bind to localhost only (if same server)
- ✅ Use Redis ACLs for fine-grained permissions

### 4. API Security
- ✅ Enable rate limiting on API routes
- ✅ Use HTTPS only (no HTTP in production)
- ✅ Set secure cookie flags: `httpOnly`, `secure`, `sameSite`
- ✅ Implement CSRF protection
- ✅ Add helmet.js for HTTP headers

### 5. OAuth Security
- ✅ Whitelist redirect URIs
- ✅ Validate state parameter
- ✅ Use HTTPS for all OAuth callbacks
- ✅ Review OAuth scopes regularly

---

## 📊 Monitoring & Maintenance

### Application Monitoring

**Health Check Endpoint**:
```bash
curl https://api.yourdomain.com/health
```

**Bull Board Dashboard**:
```
https://api.yourdomain.com/admin/queues
```
⚠️ Add authentication before exposing publicly!

**Database Health**:
```bash
docker exec reachinbox-postgres pg_isready -U reachinbox
```

**Redis Health**:
```bash
docker exec reachinbox-redis redis-cli ping
```

### Logging

**View Logs**:
```bash
# Backend logs
docker logs reachinbox-backend -f

# Worker logs
docker logs reachinbox-worker -f

# All services
docker-compose -f docker-compose.prod.yml logs -f
```

**Log Rotation**:
Configure Docker log rotation in `/etc/docker/daemon.json`:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

### Backups

**Database Backup**:
```bash
# Backup
docker exec reachinbox-postgres pg_dump -U reachinbox reachinbox_prod > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i reachinbox-postgres psql -U reachinbox reachinbox_prod < backup.sql
```

**Redis Backup**:
```bash
# Backup
docker exec reachinbox-redis redis-cli BGSAVE
docker cp reachinbox-redis:/data/dump.rdb ./redis_backup_$(date +%Y%m%d).rdb
```

---

## 🔄 Updates & Maintenance

### Rolling Updates

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker-compose -f docker-compose.prod.yml build

# Restart services (zero downtime with multiple workers)
docker-compose -f docker-compose.prod.yml up -d --no-deps backend
docker-compose -f docker-compose.prod.yml up -d --no-deps worker
docker-compose -f docker-compose.prod.yml up -d --no-deps frontend
```

### Database Migrations

```bash
# Always backup before migrating!
npm run prisma:migrate deploy
```

---

## 🚨 Troubleshooting

### High Memory Usage

**Elasticsearch**:
```bash
# Reduce heap size in docker-compose
ES_JAVA_OPTS=-Xms512m -Xmx512m
```

**Redis**:
```bash
# Check memory usage
docker exec reachinbox-redis redis-cli INFO memory

# Set maxmemory
docker exec reachinbox-redis redis-cli CONFIG SET maxmemory 256mb
```

### Worker Not Processing

```bash
# Check worker logs
docker logs reachinbox-worker -f

# Check Redis connection
docker exec reachinbox-redis redis-cli KEYS "bull:email-jobs:*"

# Check Bull Board
https://api.yourdomain.com/admin/queues
```

### Database Connection Issues

```bash
# Test connection
docker exec reachinbox-postgres psql -U reachinbox -c "SELECT 1"

# Check connections
docker exec reachinbox-postgres psql -U reachinbox -c "SELECT count(*) FROM pg_stat_activity"
```

---

## 📈 Performance Optimization

### PostgreSQL
```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_email_jobs_user_status ON email_jobs(campaign_id, status);

-- Vacuum regularly
VACUUM ANALYZE email_jobs;
```

### Redis
```bash
# Monitor slow queries
redis-cli SLOWLOG GET 10

# Check keyspace
redis-cli INFO keyspace
```

### Worker Scaling
```env
# Increase concurrency
WORKER_CONCURRENCY=20

# Run multiple worker containers
docker-compose -f docker-compose.prod.yml up -d --scale worker=3
```

---

## ✅ Production Launch Checklist

- [ ] All environment variables set correctly
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] Google OAuth configured for production domain
- [ ] SMTP credentials tested
- [ ] Rate limits configured appropriately
- [ ] Monitoring and alerting set up
- [ ] Backup strategy in place
- [ ] Log rotation configured
- [ ] Bull Board authentication added
- [ ] Health checks passing
- [ ] Load testing completed
- [ ] Security audit performed
- [ ] Documentation updated
- [ ] Team trained on maintenance procedures

---

## 🆘 Support & Rollback

### Rollback Procedure

```bash
# Stop current deployment
docker-compose -f docker-compose.prod.yml down

# Restore database backup
docker exec -i reachinbox-postgres psql -U reachinbox reachinbox_prod < backup_previous.sql

# Deploy previous version
git checkout <previous-commit>
docker-compose -f docker-compose.prod.yml up -d
```

### Emergency Contacts

- Database Admin: [Contact]
- DevOps Team: [Contact]
- On-Call Engineer: [Contact]

---

**Last Updated**: September 2026  
**Maintained By**: ReachInbox Engineering Team
