import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';

async function start() {
  try {
    await connectDB();
    const app = createApp();

    const server = app.listen(env.port, () => {
      console.log(`[server] RetailBrain API listening on port ${env.port} (${env.nodeEnv})`);
    });

    const shutdown = (signal) => {
      console.log(`[server] ${signal} received, shutting down gracefully...`);
      server.close(() => process.exit(0));
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('[server] failed to start:', err);
    process.exit(1);
  }
}

start();
