import { getDb } from '../_lib/mongo.js';
import { computeAnalytics, rangeOf } from '../_lib/analytics.js';

/* Analytics (the nav revamp, milestone 6): the numbers on the Analytics
 * home, computed on the server from the records already stored, so the
 * payload is small (a few KPIs, three short series, the funnel, income by
 * package, the meetings count) and the client caches it briefly.
 *
 *   GET /api/admin/analytics?range=month|90|year    the payload of api/_lib/analytics.js
 *
 * Reads only: the leads that are not deleted, projected to the fields the
 * rules read, and the projects. Dates are America/New_York. */

const LEAD_FIELDS = { stage: 1, deleted: 1, callStatus: 1, callLog: 1, createdAt: 1, clientSince: 1, retainer: 1, purchases: 1, deal: 1, checklists: 1, nextAction: 1, meeting: 1 };
const PROJECT_FIELDS = { archived: 1, packageId: 1, kind: 1, invoices: 1, schedule: 1, checklists: 1, nextAction: 1 };

export async function handler(req, res) {
  const db = await getDb();
  const range = rangeOf(req.query?.range);
  const [leads, projects] = await Promise.all([
    db.collection('call_leads').find({ deleted: { $ne: true } }).project(LEAD_FIELDS).toArray(),
    db.collection('projects').find({}).project(PROJECT_FIELDS).toArray(),
  ]);
  res.setHeader('Cache-Control', 'private, max-age=60');
  return res.status(200).json(computeAnalytics(leads, projects, { range, now: Date.now() }));
}
