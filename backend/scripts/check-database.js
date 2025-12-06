/**
 * Script to check database tables
 */
const { buildDatabaseUrl, loadEnvFile } = require('./build-database-url');
const { PrismaClient } = require('@prisma/client');

// Load environment and build DATABASE_URL
const env = { ...process.env, ...loadEnvFile() };
const databaseUrl = buildDatabaseUrl(env);
process.env.DATABASE_URL = databaseUrl;

console.log('Database URL:', databaseUrl.replace(/:[^:@]+@/, ':****@')); // Hide password
console.log('');

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('Checking database tables...\n');
    
    // Get all tables
    const tables = await prisma.$queryRaw`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME
    `;
    
    console.log('Tables found in database:');
    if (tables.length === 0) {
      console.log('  ❌ No tables found!');
      console.log('\n💡 You need to run migrations: npm run prisma:migrate');
    } else {
      tables.forEach((table, index) => {
        console.log(`  ${index + 1}. ${table.TABLE_NAME}`);
      });
    }
    
    // Check if User table exists
    const userTable = tables.find(t => 
      t.TABLE_NAME.toLowerCase() === 'user'
    );
    
    if (userTable) {
      console.log('\n✅ User table exists!');
    } else {
      console.log('\n❌ User table does not exist!');
      console.log('💡 Run: npm run prisma:migrate');
    }
    
  } catch (error) {
    console.error('Error checking database:', error.message);
    if (error.message.includes('does not exist')) {
      console.log('\n💡 The database might not exist. Check your .env file database configuration.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();

