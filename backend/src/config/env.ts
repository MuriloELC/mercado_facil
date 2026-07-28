import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

let loaded = false;

export function loadEnv(): void {
  if (loaded) {
    return;
  }

  const root = process.cwd();
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  const envFiles = [
    join(root, `.env.${nodeEnv}.local`),
    join(root, '.env.local'),
    join(root, `.env.${nodeEnv}`),
    join(root, '.env'),
  ];

  for (const file of envFiles) {
    if (existsSync(file)) {
      config({ path: file, override: false });
    }
  }

  loaded = true;
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Required environment variable ${name} is not configured.`);
  }

  return value;
}
