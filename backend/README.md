# EvoZap API

WhatsApp Business API backend for SalvaZap platform.

## Tech Stack

- NestJS
- Prisma ORM
- MySQL
- Redis
- BullMQ
- JWT Authentication
- AES-256 Encryption

## Setup

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- Redis

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# Copy the example environment file
cp env.example .env
# Edit .env with your database configuration (DB_HOST, DB_PORT, DB_USERNAME, etc.)
```

3. Set up database:

**Option A: Using Docker (Recommended for development)**
```bash
# Start MySQL and Redis containers
docker-compose up -d mysql redis

# Wait a few seconds for MySQL to be ready, then run migrations
npm run db:setup
```

**Option B: Using local MySQL**
```bash
# Make sure MySQL is running and create the database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS evozap;"

# Generate Prisma Client and run migrations
npm run db:setup
```

**Option C: Using npm scripts**
```bash
# Generate Prisma Client
npm run prisma:generate

# Create and run migrations
npm run prisma:migrate

# Or use the combined setup command
npm run db:setup
```

4. Verify database connection:
```bash
# Check health endpoint after starting the app
curl http://localhost:3000/health
```

5. Run the application:
```bash
npm run start:dev
```

### Database Management

- **View database in Prisma Studio**: `npm run prisma:studio`
- **Create a new migration**: `npm run prisma:migrate`
- **Reset database** (⚠️ deletes all data): `npm run prisma:reset`
- **Deploy migrations** (production): `npm run prisma:migrate:deploy`

## Docker

### Development

```bash
docker-compose up -d
```

### Production

```bash
docker-compose -f docker-compose.yml up -d
```

## API Endpoints

### Authentication
- `POST /auth/login` - Login
- `POST /auth/register` - Register

### Shops
- `POST /shops` - Create shop
- `GET /shops` - List shops
- `GET /shops/:id` - Get shop

### WABA
- `GET /waba/embedded/start` - Get embedded signup URL
- `GET /waba/embedded/callback` - Handle OAuth callback

### Webhooks
- `GET /webhooks/meta` - Webhook verification
- `POST /webhooks/meta` - Webhook ingestion
- `POST /webhooks/replay/:eventId` - Replay event

### Messages
- `POST /messages/send` - Send plain text message
- `POST /messages/template` - Send template message

### Inbox
- `GET /inbox/conversations` - List conversations
- `GET /inbox/conversations/:id` - Get conversation messages

### Templates
- `GET /templates` - List templates
- `POST /templates/submit` - Submit template
- `PATCH /templates/:id` - Update template status

### Campaigns
- `POST /campaigns` - Create campaign
- `GET /campaigns` - List campaigns
- `GET /campaigns/:id` - Get campaign

### Health
- `GET /health` - Health check
- `GET /metrics` - Metrics

## Environment Variables

See `.env.example` for required environment variables.

## License

UNLICENSED

