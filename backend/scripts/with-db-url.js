/**
 * Wrapper script to set DATABASE_URL from individual env variables before running Prisma commands
 * Usage: node scripts/with-db-url.js <command>
 */

const { spawn } = require('child_process');
const { buildDatabaseUrl, loadEnvFile } = require('./build-database-url');

// Load environment variables
const env = { ...process.env, ...loadEnvFile() };

// Build DATABASE_URL from individual variables
const databaseUrl = buildDatabaseUrl(env);
env.DATABASE_URL = databaseUrl;

// Get command and arguments from command line
const [,, ...args] = process.argv;

if (args.length === 0) {
  console.error('Usage: node scripts/with-db-url.js <command> [args...]');
  process.exit(1);
}

// Spawn the command with updated environment
const child = spawn(args[0], args.slice(1), {
  stdio: 'inherit',
  env: env,
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

