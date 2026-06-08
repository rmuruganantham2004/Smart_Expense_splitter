import { FastifyInstance } from 'fastify';
import { parseExpense } from '../controllers/ai.js';
import { authenticate } from '../middleware/auth.js';

export default async function aiRoutes(fastify: FastifyInstance) {
  // Apply auth check to all AI routes
  fastify.addHook('preHandler', authenticate);

  fastify.post('/parse-expense', parseExpense);
}
