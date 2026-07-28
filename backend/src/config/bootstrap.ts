import { loadEnv, requireEnv } from './env';

loadEnv();

if ((process.env.NODE_ENV ?? 'development') !== 'test') {
  requireEnv('JWT_SECRET');
}
