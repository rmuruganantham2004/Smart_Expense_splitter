import { FastifyInstance } from 'fastify';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../controllers/expenses.js';
import { authenticate } from '../middleware/auth.js';

export default async function expenseRoutes(fastify: FastifyInstance) {
  // Apply auth check to all expense routes
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', getExpenses);
  fastify.post('/', createExpense);
  fastify.put('/:id', updateExpense);
  fastify.delete('/:id', deleteExpense);
}
