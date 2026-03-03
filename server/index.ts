import 'dotenv/config';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'crypto';
import { validateEnv } from './config/env';
import { initializeDatabase } from './db/init';
import { closeDatabaseConnections } from './db/connection';
import { createRedisClient } from './redis/client';
import { initializeQueues } from './queues/queues';
import { registerQueueRoutes } from './routes/admin/queues';
import { authRoutes } from './routes/auth';
import { memberRoutes } from './routes/members';
import { savingsRoutes } from './routes/savings';
import { loanRoutes } from './routes/loans';
import { createAuthenticationMiddleware } from './middleware/authentication';
import { createIdempotencyMiddleware } from './middleware/idempotency';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
  requestIdLogLabel: 'requestId',
  genReqId: () => randomUUID(),
});

async function start() {
  try {
    // Validate environment variables
    const env = validateEnv();

    // Initialize database connections
    const { mainDb, mainPool, replicaDb, replicaPool } = await initializeDatabase(env);

    // Initialize Redis client
    const redis = createRedisClient(env);

    // Initialize BullMQ queues
    const queues = initializeQueues(redis);

    // Register security plugins
    await fastify.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    });

    // Register CORS
    await fastify.register(cors, {
      origin: env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    });

    // Register cookie support
    await fastify.register(cookie, {
      secret: env.JWT_SECRET,
    });

    // Register rate limiting
    await fastify.register(rateLimit, {
      max: env.RATE_LIMIT_MAX,
      timeWindow: env.RATE_LIMIT_WINDOW,
      redis: redis.getClient(),
    });

    // Register decorators
    fastify.decorate('redis', redis);
    fastify.decorate('authenticate', createAuthenticationMiddleware(env.JWT_SECRET, redis));
    fastify.decorate('requireIdempotency', createIdempotencyMiddleware(redis));

    // Health check endpoints
    fastify.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Test endpoint
    fastify.get('/test', async () => {
      return { message: 'Test endpoint works!' };
    });

    fastify.get('/health/ready', async () => {
      // Check database connectivity
      let dbHealthy = false;
      try {
        await mainPool.query('SELECT 1');
        dbHealthy = true;
      } catch (error) {
        fastify.log.error({ err: error }, 'Database health check failed');
      }

      // Check Redis connectivity
      const redisHealthy = await redis.isHealthy();

      const isReady = dbHealthy && redisHealthy;

      return {
        status: isReady ? 'ready' : 'not_ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: dbHealthy ? 'ok' : 'failed',
          redis: redisHealthy ? 'ok' : 'failed',
        },
      };
    });

    fastify.get('/health/live', async () => {
      return { status: 'live', timestamp: new Date().toISOString() };
    });

    // Register admin queue monitoring routes
    await registerQueueRoutes(fastify, queues);

    // Register authentication routes
    await authRoutes(fastify, {});

    // Register member routes
    await memberRoutes(fastify);

    // Register savings routes
    await savingsRoutes(fastify);

    // Register loan routes
    await fastify.register(loanRoutes, { prefix: '/api/v1/loans' });

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        fastify.log.info(`Received ${signal}, closing server gracefully`);
        await fastify.close();
        await queues.closeAll();
        await closeDatabaseConnections([mainPool, replicaPool]);
        await redis.close();
        process.exit(0);
      });
    });

    // Start server
    const port = env.PORT || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
