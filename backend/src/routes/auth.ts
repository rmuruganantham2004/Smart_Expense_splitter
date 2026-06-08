import { FastifyInstance } from 'fastify';
import { register, login, getProfile, markNotificationsRead } from '../controllers/auth.js';
import { authenticate } from '../middleware/auth.js';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', register);
  fastify.post('/login', login);
  
  // Protected routes
  fastify.get('/profile', { preHandler: [authenticate] }, getProfile);
  fastify.post('/notifications/read', { preHandler: [authenticate] }, markNotificationsRead);
}
