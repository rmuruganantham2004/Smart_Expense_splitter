import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import groupRoutes from './routes/groups.js';
import expenseRoutes from './routes/expenses.js';
import aiRoutes from './routes/ai.js';
import settlementRoutes from './routes/settlements.js';
import prisma from './prisma/client.js';

dotenv.config();

const fastify = Fastify({
  logger: true,
});

// Register CORS
fastify.register(cors, {
  origin: true, // Allow all origins for local dev; restrict in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

// Register JWT
fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'smartexpense-super-secret-key-change-in-production',
});

// Root check route
fastify.get('/health', async () => {
  return { status: 'OK', timestamp: new Date().toISOString() };
});

// Register API Routes
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(groupRoutes, { prefix: '/api/groups' });
fastify.register(expenseRoutes, { prefix: '/api/expenses' });
fastify.register(aiRoutes, { prefix: '/api/ai' });
fastify.register(settlementRoutes, { prefix: '/api/settlements' });

// Global Error Handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  
  if (error.statusCode) {
    return reply.status(error.statusCode).send({
      success: false,
      message: error.message,
    });
  }

  return reply.status(500).send({
    success: false,
    message: 'Internal server error. Please try again later.',
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });
});

// Hook to disconnect Prisma on server close
fastify.addHook('onClose', async () => {
  await prisma.$disconnect();
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '4000', 10);
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    console.log(`🚀 Server listening at http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
