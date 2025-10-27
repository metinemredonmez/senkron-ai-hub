import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
  ssl: boolean;
  logging: boolean;
  runMigrations: boolean;
}

export const databaseConfig = registerAs(
  'database',
  (): DatabaseConfig => ({
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'tourism_user',
    password: process.env.DB_PASSWORD ?? 'tourism_pass',
    name: process.env.DB_NAME ?? 'tourism_db',
    ssl: (process.env.DB_SSL ?? 'false').toLowerCase() === 'true',
    logging: (process.env.DB_LOGGING ?? 'false').toLowerCase() === 'true',
    runMigrations:
      (process.env.DB_RUN_MIGRATIONS ?? 'true').toLowerCase() === 'true',
  }),
);

export default databaseConfig;
