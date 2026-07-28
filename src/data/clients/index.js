// Client registry for the Work page.
// To add a client: duplicate example-client.js, edit it, then add it here.
// Order in this array = order on /work (first = most prominent).
import exampleClient from './example-client';

export const clients = [
  exampleClient,
];

export const getClient = (slug) => clients.find((c) => c.slug === slug);
