import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

let hasLoggedConnection = false;

export async function connectDB() {
  mongoose.connection.on('error', (err) => {
    console.error('[mongodb] connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    if (hasLoggedConnection) console.warn('[mongodb] disconnected');
  });

  await mongoose.connect(env.mongodbUri);
  hasLoggedConnection = true;
  console.log(`[mongodb] connected -> ${mongoose.connection.name}`);
}

/**
 * Cheap, synchronous status check used by the health endpoint.
 * readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
 */
export function getDbStatus() {
  const state = mongoose.connection.readyState;
  return state === 1 ? 'connected' : 'disconnected';
}

export async function disconnectDB() {
  await mongoose.connection.close();
}
