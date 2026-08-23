import dotenv from 'dotenv';

dotenv.config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    // Fail fast and loud rather than limping along with `undefined` secrets.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  port: Number(process.env.PORT) || 5000,

  mongodbUri: required('MONGODB_URI'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  crossSiteCookies: process.env.CROSS_SITE_COOKIES === 'true',

  demoUserPassword: process.env.DEMO_USER_PASSWORD || 'demo-password-not-used-for-login',
};
