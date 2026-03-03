import type { FastifyInstance } from 'fastify';
import type { Queues } from '../../queues/queues';

/**
 * Admin queue monitoring endpoints
 * Requires ADMIN role (to be implemented in Task 5.5)
 */
export async function registerQueueRoutes(fastify: FastifyInstance, queues: Queues) {
  // Get queue statistics
  fastify.get('/admin/queues/stats', async (request, reply) => {
    // TODO: Add authentication middleware in Task 5.5
    const stats = await queues.getHealthStatus();
    return { success: true, data: stats };
  });

  // Get specific queue details
  fastify.get('/admin/queues/:queueName', async (request, reply) => {
    // TODO: Add authentication middleware in Task 5.5
    const { queueName } = request.params as { queueName: string };

    let queue;
    switch (queueName) {
      case 'notification':
        queue = queues.notificationQueue;
        break;
      case 'payroll':
        queue = queues.payrollQueue;
        break;
      case 'report':
        queue = queues.reportQueue;
        break;
      case 'reconciliation':
        queue = queues.reconciliationQueue;
        break;
      default:
        return reply.code(404).send({ success: false, error: 'Queue not found' });
    }

    const [counts, waiting, active, completed, failed] = await Promise.all([
      queue.getJobCounts(),
      queue.getWaiting(0, 10),
      queue.getActive(0, 10),
      queue.getCompleted(0, 10),
      queue.getFailed(0, 10),
    ]);

    return {
      success: true,
      data: {
        name: queueName,
        counts,
        jobs: {
          waiting: waiting.map((j) => ({ id: j.id, name: j.name, data: j.data })),
          active: active.map((j) => ({ id: j.id, name: j.name, data: j.data })),
          completed: completed.map((j) => ({ id: j.id, name: j.name, returnvalue: j.returnvalue })),
          failed: failed.map((j) => ({
            id: j.id,
            name: j.name,
            failedReason: j.failedReason,
            attemptsMade: j.attemptsMade,
          })),
        },
      },
    };
  });
}
