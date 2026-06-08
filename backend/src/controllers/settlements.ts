import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import prisma from '../prisma/client.js';
import { minimizeCashFlow } from '../utils/settlement.js';

const createSettlementSchema = z.object({
  fromId: z.string(),
  toId: z.string(),
  amount: z.number().positive('Amount must be positive'),
});

export async function getOptimizedSettlements(request: FastifyRequest, reply: FastifyReply) {
  const { groupId } = request.params as { groupId: string };
  const userId = request.user.id;

  // Verify membership
  const member = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId,
      },
    },
  });

  if (!member) {
    return reply.status(403).send({
      success: false,
      message: 'You are not a member of this group.',
    });
  }

  // Load group details
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      expenses: {
        include: {
          participants: true,
        },
      },
      settlements: true,
    },
  });

  if (!group) {
    return reply.status(404).send({
      success: false,
      message: 'Group not found.',
    });
  }

  // Calculate net balances for each member
  const balancesMap: Record<string, {
    userId: string;
    name: string;
    email: string;
    balance: number;
    totalPaid: number;
    totalOwed: number;
    settlementsSent: number;
    settlementsReceived: number;
  }> = {};

  group.members.forEach(m => {
    balancesMap[m.userId] = {
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      balance: 0,
      totalPaid: 0,
      totalOwed: 0,
      settlementsSent: 0,
      settlementsReceived: 0,
    };
  });

  // 1. Accumulate paid expenses and shares
  group.expenses.forEach(exp => {
    if (balancesMap[exp.paidById]) {
      balancesMap[exp.paidById].totalPaid += exp.amount;
    }
    exp.participants.forEach(part => {
      if (balancesMap[part.userId]) {
        balancesMap[part.userId].totalOwed += part.shareAmount;
      }
    });
  });

  // 2. Accumulate settlements
  group.settlements.forEach(settle => {
    if (balancesMap[settle.fromId]) {
      balancesMap[settle.fromId].settlementsSent += settle.amount;
    }
    if (balancesMap[settle.toId]) {
      balancesMap[settle.toId].settlementsReceived += settle.amount;
    }
  });

  // 3. Compute net balance
  const memberBalances = Object.values(balancesMap).map(m => {
    const balance = m.totalPaid - m.totalOwed + m.settlementsSent - m.settlementsReceived;
    return {
      userId: m.userId,
      name: m.name,
      email: m.email,
      balance: Math.round(balance * 100) / 100,
    };
  });

  // 4. Run minimizeCashFlow algorithm
  const optimizedSettlements = minimizeCashFlow(memberBalances);

  return reply.status(200).send({
    success: true,
    currency: group.currency,
    balances: memberBalances,
    optimizedSettlements,
  });
}

export async function createSettlement(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { groupId } = request.params as { groupId: string };
    const requesterId = request.user.id;
    const { fromId, toId, amount } = createSettlementSchema.parse(request.body);

    // Verify membership of requester
    const member = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: requesterId,
        },
      },
    });

    if (!member) {
      return reply.status(403).send({
        success: false,
        message: 'You are not a member of this group.',
      });
    }

    // Verify both participants belong to this group
    const sender = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: fromId } },
      include: { user: true },
    });

    const recipient = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: toId } },
      include: { user: true },
    });

    if (!sender || !recipient) {
      return reply.status(400).send({
        success: false,
        message: 'Both sender and recipient must be members of the group.',
      });
    }

    // Create the settlement record
    const settlement = await prisma.$transaction(async (tx) => {
      const s = await tx.settlement.create({
        data: {
          groupId,
          fromId,
          toId,
          amount: Math.round(amount * 100) / 100,
        },
        include: {
          fromUser: { select: { id: true, name: true } },
          toUser: { select: { id: true, name: true } },
        },
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          groupId,
          userId: requesterId,
          action: 'RECORD_SETTLEMENT',
          details: `recorded a settlement payment: ${sender.user.name} paid ${recipient.user.name} ${s.amount}`,
        },
      });

      // Notify recipient
      await tx.notification.create({
        data: {
          userId: toId,
          message: `${sender.user.name} recorded a payment of ${s.amount} to settle their balance.`,
        },
      });

      return s;
    });

    return reply.status(201).send({
      success: true,
      message: 'Settlement recorded successfully.',
      settlement,
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
