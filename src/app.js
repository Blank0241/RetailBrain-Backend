import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';

import { env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimitMiddleware.js';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js';

import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import predictionRoutes from './routes/predictionRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import userRoutes from './routes/userRoutes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // needed for secure cookies behind a proxy/load balancer

  app.use(helmet());
  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: true, // required so the browser sends/receives the httpOnly auth cookie
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(mongoSanitize()); // strips $ / . operators from req.body/query/params to prevent NoSQL injection

  if (!env.isProd) {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined'));
  }

  app.use('/api', apiLimiter);

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/predictions', predictionRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/users', userRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
