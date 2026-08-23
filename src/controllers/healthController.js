import { getDbStatus } from '../config/db.js';

export function getHealth(req, res) {
  const database = getDbStatus();
  res.status(200).json({
    success: true,
    message: 'RetailBrain API is running',
    database,
  });
}
