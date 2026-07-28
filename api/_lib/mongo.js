import { MongoClient } from 'mongodb';

// Cached across warm serverless invocations to avoid reconnect storms.
let clientPromise = globalThis._vzMongo;

export async function getDb() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  if (!clientPromise) {
    clientPromise = globalThis._vzMongo = new MongoClient(process.env.MONGODB_URI, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 8000,
    }).connect();
  }
  const client = await clientPromise;
  // Db name comes from the URI path (/visualize); fall back explicitly.
  return client.db(client.options?.dbName || 'visualize');
}
