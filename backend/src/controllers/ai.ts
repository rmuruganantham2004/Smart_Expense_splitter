import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import prisma from '../prisma/client.js';
import { parseExpenseText } from '../utils/aiParser.js';

const parseExpenseInputSchema = z.object({
  text: z.string().min(1, 'Text to parse is required'),
  groupId: z.string().optional(),
});

export async function parseExpense(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { text, groupId } = parseExpenseInputSchema.parse(request.body);
    const userId = request.user.id;

    let knownMembers: string[] = [];

    // If groupId is provided, fetch members to help match names
    if (groupId) {
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });

      if (membership) {
        const members = await prisma.groupMember.findMany({
          where: { groupId },
          include: {
            user: {
              select: { name: true },
            },
          },
        });
        knownMembers = members.map(m => m.user.name);
      }
    }

    const parsedResult = await parseExpenseText(text, knownMembers);

    return reply.status(200).send({
      success: true,
      parsed: parsedResult,
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
