/**
 * Script to build DATABASE_URL from individual environment variables
 * This is used by Prisma CLI commands (migrate, generate, etc.)
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  
  if (!fs.existsSync(envPath)) {
    console.warn('Warning: .env file not found');
    return {};
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envContent.split('\n').forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        let value = valueParts.join('=');
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        envVars[key.trim()] = value.trim();
      }
    }
  });

  return envVars;
}

function buildDatabaseUrl(env) {
  // Check if DATABASE_URL is already set
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }

  // Build from individual variables
  const host = env.DB_HOST || 'localhost';
  const port = env.DB_PORT || '3306';
  const username = env.DB_USERNAME || 'root';
  const password = env.DB_PASSWORD || '';
  const database = env.DB_NAME || env.DB_DATABASE || 'evozap';
  const schema = env.DB_SCHEMA || 'public';

  return `mysql://${username}:${password}@${host}:${port}/${database}?schema=${schema}`;
}

// Load environment
const env = { ...process.env, ...loadEnvFile() };

// Build and set DATABASE_URL
const databaseUrl = buildDatabaseUrl(env);
process.env.DATABASE_URL = databaseUrl;

// Export for use in other scripts
if (require.main === module) {
  console.log(databaseUrl);
  process.exit(0);
}

module.exports = { buildDatabaseUrl, loadEnvFile };

