import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServer } from '../server/index';

let app: any = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!app) {
    app = await createServer();
    await app.ready();
  }
  
  // Forward the request to Fastify
  app.server.emit('request', req, res);
}
