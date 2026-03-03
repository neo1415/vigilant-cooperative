import type { FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodSchema } from 'zod';

/**
 * Request validation middleware with Zod schemas
 */
export function validateRequest(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validate body
      if (schema.body) {
        request.body = schema.body.parse(request.body);
      }

      // Validate query
      if (schema.query) {
        request.query = schema.query.parse(request.query);
      }

      // Validate params
      if (schema.params) {
        request.params = schema.params.parse(request.params);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: error.issues.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
        });
      }

      throw error;
    }
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  uuid: z.string().uuid(),
  positiveInteger: z.number().int().positive(),
  nonNegativeInteger: z.number().int().min(0),
  koboAmount: z.number().int().min(0),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};
