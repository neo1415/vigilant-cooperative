import type { FastifyInstance } from 'fastify';
import { db } from '../db/init';
import { payrollImports } from '../db/schema';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse, ErrorCode } from '../../utils/api-response';
import { parsePayrollCSV, validatePayrollData } from '../../services/payroll.service';
import type { AuthenticatedUser } from '../middleware/authentication';
import { generateReference } from '../../utils/reference';

export async function payrollRoutes(fastify: FastifyInstance) {
  // Upload and process payroll CSV
  fastify.post(
    '/api/v1/payroll/import',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      const requestId = request.id;

      // Check if user is treasurer
      if (!user.roles.includes('TREASURER')) {
        return reply.status(403).send(
          errorResponse(ErrorCode.FORBIDDEN, 'Only treasurers can import payroll', requestId)
        );
      }

      try {
        const { csvContent, periodMonth, periodYear } = request.body as {
          csvContent: string;
          periodMonth: number;
          periodYear: number;
        };

        // Parse CSV
        const parseResult = parsePayrollCSV(csvContent);
        if (!parseResult.success) {
          return reply.status(400).send(
            errorResponse(ErrorCode.VALIDATION_ERROR, parseResult.error, requestId)
          );
        }

        // Validate data
        const validationResult = await validatePayrollData(parseResult.value);
        if (!validationResult.success) {
          return reply.status(500).send(
            errorResponse(ErrorCode.DATABASE_ERROR, validationResult.error, requestId)
          );
        }

        const { validRows, errors } = validationResult.value;

        // Create import record
        const importReference = await generateReference('PAY');
        const [importRecord] = await db
          .insert(payrollImports)
          .values({
            importReference,
            periodMonth,
            periodYear,
            status: 'PARSED',
            fileUrl: '', // Would store in R2 in production
            totalMembers: validRows.length,
            totalAmountKobo: 0,
            uploadedBy: user.id,
            errorLog: errors.length > 0 ? errors : null,
          })
          .returning();

        // Queue processing job
        const queues = (fastify as FastifyInstance & { queues?: { payrollQueue?: { add: (name: string, data: unknown) => Promise<void> } } }).queues;
        if (queues?.payrollQueue) {
          await queues.payrollQueue.add('process-payroll', {
            importId: importRecord!.id,
            rows: validRows,
            periodMonth,
            periodYear,
            uploadedBy: user.id,
          });
        }

        return reply.send(
          successResponse({
            importId: importRecord!.id,
            importReference,
            totalRows: parseResult.value.length,
            validRows: validRows.length,
            errors,
            status: 'PROCESSING',
          }, requestId)
        );
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to import payroll');
        return reply.status(500).send(
          errorResponse(ErrorCode.DATABASE_ERROR, 'Failed to import payroll', requestId)
        );
      }
    }
  );

  // Get import status
  fastify.get(
    '/api/v1/payroll/import/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const requestId = request.id;

      try {
        const [importRecord] = await db
          .select()
          .from(payrollImports)
          .where(eq(payrollImports.id, id))
          .limit(1);

        if (!importRecord) {
          return reply.status(404).send(
            errorResponse(ErrorCode.NOT_FOUND, 'Import not found', requestId)
          );
        }

        return reply.send(successResponse(importRecord, requestId));
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to get import status');
        return reply.status(500).send(
          errorResponse(ErrorCode.DATABASE_ERROR, 'Failed to get import status', requestId)
        );
      }
    }
  );
}
