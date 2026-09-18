/* The in-memory MongoDB fake the endpoint tests swap in for api/_lib/mongo.js
 * (scripts/security-test.mjs, scripts/pipeline-test.mjs). Plain ESM source,
 * copied into the temp api/ tree, never imported from here directly. */
import crypto from 'node:crypto';
export const _stores = {};
export const _log = [];
export const _reset = () => { for (const k of Object.keys(_stores)) delete _stores[k]; _log.length = 0; };
const store = (n) => (_stores[n] = _stores[n] || []);
const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof RegExp) && v.constructor && (v.constructor.name === 'Object');
const norm = (v) => (v instanceof Date ? v.getTime() : (v && typeof v === 'object' && typeof v.toHexString === 'function') ? v.toHexString() : v);
const getPath = (o, k) => k.split('.').reduce((x, p) => (x == null ? undefined : x[p]), o);
function setPath(o, k, v) { const parts = k.split('.'); let cur = o; for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] = cur[parts[i]] || {}; cur = cur[parts[i]]; } cur[parts[parts.length - 1]] = v; }
function delPath(o, k) { const parts = k.split('.'); let cur = o; for (let i = 0; i < parts.length - 1; i++) { if (!cur[parts[i]]) return; cur = cur[parts[i]]; } delete cur[parts[parts.length - 1]]; }
function cmp(actual, v) {
  const a = norm(actual), b = norm(v);
  if (v instanceof RegExp) return v.test(String(actual ?? ''));
  if (isPlain(v)) {
    for (const [op, arg] of Object.entries(v)) {
      if (op === '$ne') { if (String(a) === String(norm(arg))) return false; continue; }
      if (op === '$in') { if (!arg.some(x => String(norm(x)) === String(a))) return false; continue; }
      if (op === '$nin') { if (arg.some(x => String(norm(x)) === String(a))) return false; continue; }
      if (op === '$exists') { if ((actual !== undefined) !== !!arg) return false; continue; }
      if (op === '$gt') { if (!(a > norm(arg))) return false; continue; }
      if (op === '$gte') { if (!(a >= norm(arg))) return false; continue; }
      if (op === '$lt') { if (!(a < norm(arg))) return false; continue; }
      if (op === '$lte') { if (!(a <= norm(arg))) return false; continue; }
      if (op === '$regex') { if (!new RegExp(arg, v.$options || '').test(String(actual ?? ''))) return false; continue; }
      if (op.startsWith('$')) throw new Error('fake mongo: unsupported operator ' + op);
      // a plain sub-document: exact match on its keys
      return JSON.stringify(actual) === JSON.stringify(v);
    }
    return true;
  }
  if (Array.isArray(actual) && !Array.isArray(v)) return actual.some(x => String(norm(x)) === String(b));
  return String(a) === String(b);
}
function matches(doc, filter) {
  return Object.entries(filter || {}).every(([k, v]) => {
    if (k === '$or') return v.some(f => matches(doc, f));
    if (k === '$and') return v.every(f => matches(doc, f));
    if (k.startsWith('$')) throw new Error('fake mongo: unsupported top level ' + k);
    return cmp(getPath(doc, k), v);
  });
}
function applyUpdate(doc, update) {
  for (const [k, v] of Object.entries(update.$set || {})) setPath(doc, k, v);
  for (const k of Object.keys(update.$unset || {})) delPath(doc, k);
  for (const [k, v] of Object.entries(update.$push || {})) {
    const cur = getPath(doc, k); const arr = Array.isArray(cur) ? cur : [];
    const items = v && typeof v === 'object' && '$each' in v ? v.$each : [v];
    let next = [...arr, ...items];
    if (v && typeof v === 'object' && typeof v.$slice === 'number') next = v.$slice < 0 ? next.slice(v.$slice) : next.slice(0, v.$slice);
    setPath(doc, k, next);
  }
}
function collection(name) {
  const list = store(name);
  const rec = (op, filter, update) => _log.push({ collection: name, op, filter, update });
  const cursor = (items) => {
    let out = [...items]; let proj = null;
    const api = {
      sort(spec) { const keys = Object.keys(spec || {}); out.sort((a, b) => { for (const k of keys) { const x = String(getPath(a, k) ?? ''); const y = String(getPath(b, k) ?? ''); if (x !== y) return (x < y ? -1 : 1) * (spec[k] < 0 ? -1 : 1); } return 0; }); return api; },
      limit(n) { out = out.slice(0, n); return api; },
      project(p) { proj = p; return api; },
      async toArray() { return proj ? out.map(d => Object.fromEntries(Object.entries(d).filter(([k]) => k === '_id' || proj[k]))) : out; },
    };
    return api;
  };
  return {
    async findOne(filter) { rec('findOne', filter); return list.find(d => matches(d, filter)) || null; },
    find(filter, opts) { rec('find', filter); const c = cursor(list.filter(d => matches(d, filter))); if (opts?.projection) c.project(opts.projection); return c; },
    async countDocuments(filter) { rec('count', filter); return list.filter(d => matches(d, filter || {})).length; },
    aggregate() { return { async toArray() { return []; } }; },
    async createIndex() { return 'ok'; },
    async insertOne(doc) { rec('insertOne', null, doc); const d = { _id: doc._id || crypto.randomBytes(12).toString('hex'), ...doc }; list.push(d); return { insertedId: d._id }; },
    async insertMany(docs) { for (const d of docs) await this.insertOne(d); return { insertedCount: docs.length }; },
    async updateOne(filter, update, opts) {
      rec('updateOne', filter, update);
      let doc = list.find(d => matches(d, filter));
      if (!doc && opts?.upsert) { doc = { _id: filter._id }; for (const [k, v] of Object.entries(update.$setOnInsert || {})) setPath(doc, k, v); list.push(doc); }
      if (!doc) return { matchedCount: 0, modifiedCount: 0 };
      applyUpdate(doc, update); return { matchedCount: 1, modifiedCount: 1 };
    },
    async updateMany(filter, update) { rec('updateMany', filter, update); let n = 0; for (const d of list) if (matches(d, filter)) { applyUpdate(d, update); n++; } return { matchedCount: n, modifiedCount: n }; },
    async findOneAndUpdate(filter, update, opts) { await this.updateOne(filter, update, opts); return { value: list.find(d => matches(d, filter)) || null }; },
    async deleteOne(filter) { rec('deleteOne', filter); const i = list.findIndex(d => matches(d, filter)); if (i >= 0) list.splice(i, 1); return { deletedCount: i >= 0 ? 1 : 0 }; },
    async deleteMany(filter) { rec('deleteMany', filter); const before = list.length; for (let i = list.length - 1; i >= 0; i--) if (matches(list[i], filter)) list.splice(i, 1); return { deletedCount: before - list.length }; },
  };
}
export async function getDb() { return { collection }; }
