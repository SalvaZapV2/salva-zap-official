import { ConfigService } from '@nestjs/config';

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  schema?: string;
}

/**
 * Build MySQL connection URL from individual database configuration variables
 */
export function buildDatabaseUrl(config: DatabaseConfig): string {
  const { host, port, username, password, database, schema = 'public' } = config;
  return `mysql://${username}:${password}@${host}:${port}/${database}?schema=${schema}`;
}

/**
 * Get database configuration from environment variables
 * Falls back to DATABASE_URL if individual variables are not set
 */
export function getDatabaseConfig(configService: ConfigService): string {
  // Check if DATABASE_URL is set (for backward compatibility)
  const databaseUrl = configService.get<string>('DATABASE_URL');
  if (databaseUrl) {
    return databaseUrl;
  }

  // Build from individual variables
  const host = configService.get<string>('DB_HOST', 'localhost');
  const port = configService.get<number>('DB_PORT', 3306);
  const username = configService.get<string>('DB_USERNAME', 'root');
  const password = configService.get<string>('DB_PASSWORD', '');
  const database = configService.get<string>('DB_NAME', 'evozap');
  const schema = configService.get<string>('DB_SCHEMA', 'public');

  return buildDatabaseUrl({
    host,
    port,
    username,
    password,
    database,
    schema,
  });
}

