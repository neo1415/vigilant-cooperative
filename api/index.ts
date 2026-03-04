import type { IncomingMessage, ServerResponse } from 'http';
import { createServer } from '../server/index';

let app: any = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!app) {
    app = await createServer();
    await app.ready();
  }
  
  // Forward the request to Fastify
  app.server.emit('request', req, res);
}
