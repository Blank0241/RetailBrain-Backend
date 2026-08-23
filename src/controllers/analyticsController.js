import * as analyticsService from '../services/analyticsService.js';

export async function getDashboard(req, res, next) {
  try {
    const data = await analyticsService.getDashboardStats(req.user.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAnalytics(req, res, next) {
  try {
    const data = await analyticsService.getAnalytics(req.user.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
