import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../prisma/client.js';

// Schemas for input validation
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string(),
});

export async function register(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { name, email, password } = registerSchema.parse(request.body);

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return reply.status(400).send({
        success: false,
        message: 'A user with this email address already exists.',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    // Sign JWT
    const token = request.server.jwt.sign({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    // Create a welcome notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        message: `Welcome to Smart Expense Splitter, ${user.name}! Create or join a group to start splitting.`,
      },
    });

    return reply.status(201).send({
      success: true,
      message: 'Account created successfully.',
      token,
      user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        success: false,
        message: error.errors[0].message,
        errors: error.errors,
      });
    }
    throw error;
  }
}

export async function login(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { email, password } = loginSchema.parse(request.body);

    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Sign JWT
    const token = request.server.jwt.sign({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    return reply.status(200).send({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        success: false,
        message: error.errors[0].message,
        errors: error.errors,
      });
    }
    throw error;
  }
}

export async function getProfile(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      notifications: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!user) {
    return reply.status(404).send({
      success: false,
      message: 'User profile not found.',
    });
  }

  return reply.status(200).send({
    success: true,
    user,
  });
}

export async function markNotificationsRead(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id;

  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  return reply.status(200).send({
    success: true,
    message: 'Notifications marked as read.',
  });
}
