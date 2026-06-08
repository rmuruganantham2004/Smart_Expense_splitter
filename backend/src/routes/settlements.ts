import { FastifyInstance } from 'fastify';
import { getOptimizedSettlements, createSettlement } from '../controllers/settlements.js';
import { authenticate } from '../middleware/auth.js';

export default async function settlementRoutes(fastify: FastifyInstance) {
  // Apply auth check to all settlement routes
  fastify.addHook('preHandler', authenticate);

  fastify.get('/:groupId', getOptimizedSettlements);
  fastify.post('/:groupId', createSettlement);
}
