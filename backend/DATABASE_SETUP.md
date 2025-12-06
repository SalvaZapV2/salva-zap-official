## Prerequisites

- Node.js 18+ installed
- MySQL 8.0+ installed and running (or Docker)
- Redis installed and running (or Docker)

## Quick Start with Docker (Recommended)

The easiest way to get started is using Docker Compose:

```bash
# Start MySQL and Redis containers
docker-compose up -d mysql redis

# Wait for MySQL to be ready (about 10-15 seconds)
# Then set up the database
npm run db:setup
```

## Manual Setup

### 1. Install MySQL

If you don't have MySQL installed:

**Windows:**
- Download MySQL Installer from https://dev.mysql.com/downloads/installer/
- Or use Chocolatey: `choco install mysql`

**macOS:**
```bash
brew install mysql
brew services start mysql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install mysql-server
sudo systemctl start mysql
```

### 2. Create Database

```bash
# Login to MySQL
mysql -u root -p

# Create database and user
CREATE DATABASE evozap;
CREATE USER 'evozap'@'localhost' IDENTIFIED BY 'evozappassword';
GRANT ALL PRIVILEGES ON evozap.* TO 'evozap'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Configure Environment Variables

Copy the example environment file:
```bash
cp env.example .env
```

Edit `.env` and configure the database connection using individual variables:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=evozap
DB_PASSWORD=evozappassword
DB_NAME=evozap
DB_SCHEMA=public
```

**Alternative:** You can still use `DATABASE_URL` if you prefer:
```env
DATABASE_URL="mysql://evozap:evozappassword@localhost:3306/evozap?schema=public"
```

**Important:** Make sure the credentials match your MySQL setup.

### 4. Generate Prisma Client

```bash
npm run prisma:generate
```

### 5. Run Migrations

```bash
npm run prisma:migrate
```

This will:
- Create the initial migration based on your schema
- Apply the migration to your database
- Create all tables and relationships

### 6. Verify Setup

Start the application:
```bash
npm run start:dev
```

Check the health endpoint:
```bash
curl http://localhost:3000/health
```

You should see:
```json
{
  "status": "ok",
  "database": "connected",
  "queues": { ... }
}
```

## Database Management Commands

### View Database in Prisma Studio

```bash
npm run prisma:studio
```

This opens a web interface at http://localhost:5555 where you can view and edit your data.

### Create a New Migration

After modifying `prisma/schema.prisma`:

```bash
npm run prisma:migrate
```

This will:
1. Create a new migration file
2. Apply it to your database
3. Regenerate the Prisma Client

### Reset Database (⚠️ Deletes All Data)

```bash
npm run prisma:reset
```

### Deploy Migrations (Production)

```bash
npm run prisma:migrate:deploy
```

This applies pending migrations without prompting (useful for CI/CD).

## Troubleshooting

### Connection Refused

**Error:** `Can't reach database server`

**Solutions:**
1. Verify MySQL is running: `mysql -u root -p`
2. Check the database configuration in `.env` (DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME)
3. Verify MySQL is listening on the correct port (default: 3306)
4. Check firewall settings

### Authentication Failed

**Error:** `Access denied for user`

**Solutions:**
1. Verify `DB_USERNAME` and `DB_PASSWORD` in `.env` are correct
2. Check user exists: `SELECT User FROM mysql.user;`
3. Verify user has privileges: `SHOW GRANTS FOR 'evozap'@'localhost';`
4. If using individual variables, ensure all fields (DB_HOST, DB_PORT, etc.) are set correctly

### Database Doesn't Exist

**Error:** `Unknown database 'evozap'`

**Solution:**
```bash
mysql -u root -p -e "CREATE DATABASE evozap;"
```

### Migration Errors

**Error:** `Migration failed`

**Solutions:**
1. Check if database is in a consistent state
2. Review migration files in `prisma/migrations/`
3. If needed, reset and re-run: `npm run prisma:reset`

### Prisma Client Not Generated

**Error:** `Cannot find module '@prisma/client'`

**Solution:**
```bash
npm run prisma:generate
```

## Database Schema

The database includes the following models:

- **User** - Application users
- **Shop** - User shops/stores
- **WabaAccount** - WhatsApp Business API accounts
- **WebhookEvent** - Incoming webhook events
- **Conversation** - Chat conversations
- **Message** - Individual messages
- **Template** - Message templates
- **Campaign** - Marketing campaigns
- **CampaignJob** - Individual campaign jobs

See `prisma/schema.prisma` for the complete schema definition.

## Database Configuration Methods

The application supports two ways to configure the database connection:

### Method 1: Individual Variables (Recommended)

Use separate environment variables for each database setting:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=evozap
DB_PASSWORD=evozappassword
DB_NAME=evozap
DB_SCHEMA=public
```

**Advantages:**
- Easier to manage individual settings
- More secure (can use different sources for credentials)
- Better for environment-specific configurations

### Method 2: Connection String

Use a single `DATABASE_URL` connection string:

```env
DATABASE_URL="mysql://evozap:evozappassword@localhost:3306/evozap?schema=public"
```

**Note:** If both are provided, `DATABASE_URL` takes precedence over individual variables.

## Production Considerations

1. **Use strong passwords** - Change default credentials
2. **Enable SSL** - Add SSL parameters to connection:
   ```env
   DB_HOST=your-host
   DB_PORT=3306
   # Or in DATABASE_URL: ...?ssl=true&sslcert=...
   ```
3. **Connection pooling** - Prisma handles this automatically
4. **Backup strategy** - Set up regular database backups
5. **Monitor connections** - Use the `/health` endpoint
6. **Migration strategy** - Use `prisma migrate deploy` in production
7. **Secure credentials** - Use environment variable management tools (AWS Secrets Manager, HashiCorp Vault, etc.)

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [NestJS Prisma Integration](https://docs.nestjs.com/recipes/prisma)

