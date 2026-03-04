import type { IncomingMessage, ServerResponse } from 'http';
import Fastify from 'fastify';

// Simplified Fastify server for Vercel serverless
let app: any = null;

async function getApp() {
  if (app) return app;
  
  // Create minimal Fastify instance
  app = Fastify({ logger: false });
  
  // Import and register all routes dynamically
  const { authRoutes } = await import('../server/routes/auth');
  const { memberRoutes } = await import('../server/routes/members');
  const { savingsRoutes } = await import('../server/routes/savings');
  const { loanRoutes } = await import('../server/routes/loans');
  const { notificationRoutes } = await import('../server/routes/notifications');
  
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(memberRoutes, { prefix: '/api/v1' });
  await app.register(savingsRoutes, { prefix: '/api/v1' });
  await app.register(loanRoutes, { prefix: '/api/v1' });
  await app.register(notificationRoutes, { prefix: '/api/v1' });
  
  await app.ready();
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const fastify = await getApp();
  fastify.server.emit('request', req, res);
}
