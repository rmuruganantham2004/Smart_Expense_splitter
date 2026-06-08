import { FastifyRequest, FastifyReply } from 'fastify';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({
      success: false,
      message: 'Unauthorized access. Please login again.',
    });
  }
}

// Extend Fastify types to recognize the JWT user payload
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; email: string; name: string };
    user: { id: string; email: string; name: string };
  }
}
