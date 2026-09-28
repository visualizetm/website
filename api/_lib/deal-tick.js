import { ObjectId } from 'mongodb';
import { dealOf, isTicked, tickPatch } from './deal.js';

/* One checkpoint ticked on its own, server side (CRM revamp, step 5): a
 * concept set created, a start brief linked. Only a booked or deal record
 * moves; an already ticked step is left alone. Best effort. */
export async function tickCheckpoint(leads, leadId, id) {
  let _id; try { _id = new ObjectId(String(leadId)); } catch { return false; }
  const lead = await leads.findOne({ _id, deleted: { $ne: true } }, { projection: { stage: 1, callStatus: 1, deal: 1, meeting: 1 } });
  if (!lead) return false;
  const stage = lead.stage || (lead.callStatus === 'booked' ? 'booked' : '');
  if (stage !== 'booked' && stage !== 'deal') return false;
  if (isTicked(dealOf(lead), id)) return false;
  await leads.updateOne({ _id }, { $set: { ...tickPatch(lead, id, 'auto'), updatedAt: new Date() } });
  return true;
}
export const tickFormReceived = (leads, leadId) => tickCheckpoint(leads, leadId, 'formReceived');
