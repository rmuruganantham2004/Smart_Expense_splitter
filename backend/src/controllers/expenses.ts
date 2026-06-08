import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import prisma from '../prisma/client.js';


const participantSchema = z.object({
  userId: z.string(),
  shareAmount: z.number().nonnegative(),
  percentage: z.number().optional().nullable(),
});

const createExpenseSchema = z.object({
  groupId: z.string(),
  amount: z.number().positive('Amount must be greater than zero'),
  description: z.string().min(1, 'Description is required'),
  date: z.string().optional(),
  paidById: z.string(),
  splitType: z.enum(['EQUAL', 'PERCENTAGE', 'EXACT']),
  participants: z.array(participantSchema).min(1, 'At least one participant is required'),
});

export async function getExpenses(request: FastifyRequest, reply: FastifyReply) {
  const { groupId, memberId } = request.query as { groupId?: string; memberId?: string };
  const userId = request.user.id;

  const whereClause: any = {};

  if (groupId) {
    // Verify user is member of the group
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!membership) {
      return reply.status(403).send({
        success: false,
        message: 'You are not a member of this group.',
      });
    }
    whereClause.groupId = groupId;
  } else {
    // If no groupId is specified, only return expenses in groups the user belongs to
    whereClause.group = {
      members: {
        some: {
          userId,
        },
      },
    };
  }

  if (memberId) {
    whereClause.OR = [
      { paidById: memberId },
      {
        participants: {
          some: {
            userId: memberId,
          },
        },
      },
    ];
  }

  const expenses = await prisma.expense.findMany({
    where: whereClause,
    include: {
      paidBy: {
        select: { id: true, name: true, email: true },
      },
      group: {
        select: { id: true, name: true, currency: true },
      },
      participants: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
    orderBy: {
      date: 'desc',
    },
  });

  return reply.status(200).send({
    success: true,
    expenses,
  });
}

export async function createExpense(request: FastifyRequest, reply: FastifyReply) {
  try {
    const data = createExpenseSchema.parse(request.body);
    const userId = request.user.id;

    // Verify requester is a member of the group
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: data.groupId,
          userId,
        },
      },
    });

    if (!membership) {
      return reply.status(403).send({
        success: false,
        message: 'You are not a member of this group.',
      });
    }

    // Verify paidBy is a member of the group
    const payerMembership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: data.groupId,
          userId: data.paidById,
        },
      },
    });

    if (!payerMembership) {
      return reply.status(400).send({
        success: false,
        message: 'The person who paid must be a member of the group.',
      });
    }

    // Process and validate splits
    const calculatedParticipants = validateAndDistributeSplits(
      data.amount,
      data.splitType,
      data.participants
    );

    const expense = await prisma.$transaction(async (tx) => {
      // 1. Create the Expense
      const exp = await tx.expense.create({
        data: {
          groupId: data.groupId,
          paidById: data.paidById,
          amount: Math.round(data.amount * 100) / 100,
          description: data.description.trim(),
          splitType: data.splitType,
          date: data.date ? new Date(data.date) : new Date(),
        },
      });

      // 2. Create the participants shares
      await tx.expenseParticipant.createMany({
        data: calculatedParticipants.map(p => ({
          expenseId: exp.id,
          userId: p.userId,
          shareAmount: p.shareAmount,
          percentage: p.percentage,
        })),
      });

      // 3. Log activity
      const payer = await tx.user.findUnique({ where: { id: data.paidById } });
      await tx.activityLog.create({
        data: {
          groupId: data.groupId,
          userId,
          action: 'ADD_EXPENSE',
          details: `added expense "${exp.description}" for ${payer?.name || 'someone'} (Amount: ${exp.amount})`,
        },
      });

      // 4. Send notification to all other group members
      const allMembers = await tx.groupMember.findMany({
        where: {
          groupId: data.groupId,
          userId: { not: userId },
        },
      });

      if (allMembers.length > 0) {
        await tx.notification.createMany({
          data: allMembers.map(m => ({
            userId: m.userId,
            message: `${request.user.name} added the expense "${exp.description}" (${exp.amount}) in the group.`,
          })),
        });
      }

      return exp;
    });

    return reply.status(201).send({
      success: true,
      message: 'Expense added successfully.',
      expense,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        success: false,
        message: error.errors[0].message,
        errors: error.errors,
      });
    }
    if (error instanceof Error && error.message.startsWith('SPLIT_VALIDATION:')) {
      return reply.status(400).send({
        success: false,
        message: error.message.replace('SPLIT_VALIDATION:', ''),
      });
    }
    throw error;
  }
}

export async function updateExpense(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const data = createExpenseSchema.parse(request.body);
    const userId = request.user.id;

    // Fetch existing expense
    const existingExpense = await prisma.expense.findUnique({
      where: { id },
      include: { group: true },
    });

    if (!existingExpense) {
      return reply.status(404).send({
        success: false,
        message: 'Expense not found.',
      });
    }

    // Verify membership in the group
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: existingExpense.groupId,
          userId,
        },
      },
    });

    if (!membership) {
      return reply.status(403).send({
        success: false,
        message: 'You are not a member of this group.',
      });
    }

    // Process and validate splits
    const calculatedParticipants = validateAndDistributeSplits(
      data.amount,
      data.splitType,
      data.participants
    );

    const expense = await prisma.$transaction(async (tx) => {
      // 1. Delete old participants shares
      await tx.expenseParticipant.deleteMany({
        where: { expenseId: id },
      });

      // 2. Update Expense
      const exp = await tx.expense.update({
        where: { id },
        data: {
          paidById: data.paidById,
          amount: Math.round(data.amount * 100) / 100,
          description: data.description.trim(),
          splitType: data.splitType,
          date: data.date ? new Date(data.date) : new Date(),
        },
      });

      // 3. Create new participants shares
      await tx.expenseParticipant.createMany({
        data: calculatedParticipants.map(p => ({
          expenseId: exp.id,
          userId: p.userId,
          shareAmount: p.shareAmount,
          percentage: p.percentage,
        })),
      });

      // 4. Log activity
      await tx.activityLog.create({
        data: {
          groupId: existingExpense.groupId,
          userId,
          action: 'UPDATE_EXPENSE',
          details: `updated the expense "${exp.description}" (New Amount: ${exp.amount})`,
        },
      });

      return exp;
    });

    return reply.status(200).send({
      success: true,
      message: 'Expense updated successfully.',
      expense,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        success: false,
        message: error.errors[0].message,
        errors: error.errors,
      });
    }
    if (error instanceof Error && error.message.startsWith('SPLIT_VALIDATION:')) {
      return reply.status(400).send({
        success: false,
        message: error.message.replace('SPLIT_VALIDATION:', ''),
      });
    }
    throw error;
  }
}

export async function deleteExpense(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const userId = request.user.id;

  const expense = await prisma.expense.findUnique({
    where: { id },
  });

  if (!expense) {
    return reply.status(404).send({
      success: false,
      message: 'Expense not found.',
    });
  }

  // Verify group membership
  const membership = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId: expense.groupId,
        userId,
      },
    },
  });

  if (!membership) {
    return reply.status(403).send({
      success: false,
      message: 'You are not authorized to delete this expense.',
    });
  }

  await prisma.$transaction(async (tx) => {
    // 1. Delete expense (cascades to participants in database)
    await tx.expense.delete({
      where: { id },
    });

    // 2. Log activity
    await tx.activityLog.create({
      data: {
        groupId: expense.groupId,
        userId,
        action: 'DELETE_EXPENSE',
        details: `deleted expense "${expense.description}" (Amount: ${expense.amount})`,
      },
    });
  });

  return reply.status(200).send({
    success: true,
    message: 'Expense deleted successfully.',
  });
}

/**
 * Validates splits and distributes floating point remainders.
 */
function validateAndDistributeSplits(
  totalAmount: number,
  splitType: string,
  participants: Array<{ userId: string; shareAmount: number; percentage?: number | null }>
) {
  const count = participants.length;
  let distributed: Array<{ userId: string; shareAmount: number; percentage: number | null }> = [];

  // Round total amount
  const targetTotal = Math.round(totalAmount * 100);

  if (splitType === 'EQUAL') {
    // Divide equally, handle remainder
    const baseShare = Math.floor(targetTotal / count);
    const remainder = targetTotal % count;

    distributed = participants.map((p, idx) => {
      // Add 1 cent to the first 'remainder' people to distribute the exact amount
      const finalShare = baseShare + (idx < remainder ? 1 : 0);
      return {
        userId: p.userId,
        shareAmount: finalShare / 100,
        percentage: 100 / count,
      };
    });

  } else if (splitType === 'PERCENTAGE') {
    // Verify percentages sum to 100%
    const totalPercentage = participants.reduce((sum, p) => sum + (p.percentage || 0), 0);
    // Allow minor float inaccuracy for sum (between 99.9% and 100.1%)
    if (Math.abs(totalPercentage - 100) > 0.1) {
      throw new Error(`SPLIT_VALIDATION:Percentages must total 100%. Current sum: ${totalPercentage}%`);
    }

    let allocatedSum = 0;
    distributed = participants.map((p, idx) => {
      const pct = p.percentage || 0;
      let finalShare = Math.round((targetTotal * pct) / 100);

      // Adjust last element to avoid rounding gaps
      if (idx === count - 1) {
        finalShare = targetTotal - allocatedSum;
      } else {
        allocatedSum += finalShare;
      }

      return {
        userId: p.userId,
        shareAmount: finalShare / 100,
        percentage: pct,
      };
    });

    // Check if any shares became negative due to bad math
    if (distributed.some(d => d.shareAmount < 0)) {
      throw new Error('SPLIT_VALIDATION:Calculated split shares cannot be negative.');
    }

  } else if (splitType === 'EXACT') {
    // Verify shares sum to the exact amount
    const totalSharesSum = participants.reduce((sum, p) => sum + Math.round(p.shareAmount * 100), 0);
    if (totalSharesSum !== targetTotal) {
      throw new Error(
        `SPLIT_VALIDATION:Exact shares must total ${totalAmount}. Current sum: ${totalSharesSum / 100}`
      );
    }

    distributed = participants.map(p => ({
      userId: p.userId,
      shareAmount: Math.round(p.shareAmount * 100) / 100,
      percentage: null,
    }));
  }

  return distributed;
}
