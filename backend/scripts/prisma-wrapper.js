/**
 * Prisma CLI wrapper that sets DATABASE_URL from individual environment variables
 * This allows Prisma commands to work with individual DB config variables
 */

const { execSync } = require('child_process');
const { buildDatabaseUrl, loadEnvFile } = require('./build-database-url');
const path = require('path');

// Load environment variables from .env file
const envVars = loadEnvFile();

// Merge with existing environment
const env = { ...process.env, ...envVars };

// Build DATABASE_URL from individual variables
const databaseUrl = buildDatabaseUrl(env);
env.DATABASE_URL = databaseUrl;

// Get the Prisma command and arguments
const [,, ...args] = process.argv;

if (args.length === 0) {
  console.error('Usage: node scripts/prisma-wrapper.js <prisma-command> [args...]');
  console.error('Example: node scripts/prisma-wrapper.js migrate dev');
  process.exit(1);
}

// Build full command - use cross-platform approach
const isWindows = process.platform === 'win32';
const command = isWindows ? 'npx.cmd' : 'npx';
const prismaArgs = ['prisma', ...args];

try {
  // Execute Prisma command with updated environment
  execSync(prismaArgs.join(' '), {
    stdio: 'inherit',
    env: env,
    cwd: path.join(__dirname, '..'),
    shell: true,
  });
} catch (error) {
  process.exit(error.status || 1);
}

