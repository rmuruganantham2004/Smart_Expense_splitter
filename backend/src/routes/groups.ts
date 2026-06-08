import { FastifyInstance } from 'fastify';
import { getGroups, createGroup, getGroupDetail, addMember, deleteGroup } from '../controllers/groups.js';
import { authenticate } from '../middleware/auth.js';

export default async function groupRoutes(fastify: FastifyInstance) {
  // Apply auth check to all group routes
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', getGroups);
  fastify.post('/', createGroup);
  fastify.get('/:id', getGroupDetail);
  fastify.delete('/:id', deleteGroup);
  fastify.post('/:id/members', addMember);
}
