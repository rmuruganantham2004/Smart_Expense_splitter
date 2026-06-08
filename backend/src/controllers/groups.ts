import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import prisma from '../prisma/client.js';

const createGroupSchema = z.object({
  name: z.string().min(2, 'Group name must be at least 2 characters'),
  description: z.string().optional(),
  currency: z.string().default('INR'),
});

const addMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function getGroups(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id;

  const memberGroups = await prisma.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          createdBy: {
            select: { id: true, name: true },
          },
          expenses: {
            select: { amount: true },
          },
        },
      },
    },
    orderBy: {
      group: {
        createdAt: 'desc',
      },
    },
  });

  const groups = memberGroups.map(mg => {
    const totalExpenses = mg.group.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    return {
      id: mg.group.id,
      name: mg.group.name,
      description: mg.group.description,
      currency: mg.group.currency,
      createdBy: mg.group.createdBy,
      createdAt: mg.group.createdAt,
      membersCount: mg.group.members.length,
      members: mg.group.members.map(m => m.user),
      totalExpenses,
    };
  });

  return reply.status(200).send({
    success: true,
    groups,
  });
}

export async function createGroup(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id;
    const { name, description, currency } = createGroupSchema.parse(request.body);

    const group = await prisma.$transaction(async (tx) => {
      // 1. Create Group
      const g = await tx.group.create({
        data: {
          name: name.trim(),
          description: description?.trim(),
          currency: currency.trim().toUpperCase(),
          createdById: userId,
        },
      });

      // 2. Add creator as a group member
      await tx.groupMember.create({
        data: {
          groupId: g.id,
          userId: userId,
        },
      });

      // 3. Log activity
      await tx.activityLog.create({
        data: {
          groupId: g.id,
          userId: userId,
          action: 'CREATE_GROUP',
          details: `created the group "${g.name}"`,
        },
      });

      return g;
    });

    return reply.status(201).send({
      success: true,
      message: 'Group created successfully.',
      group,
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

export async function getGroupDetail(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const userId = request.user.id;

  // Verify membership
  const member = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId: id,
        userId: userId,
      },
    },
  });

  if (!member) {
    return reply.status(403).send({
      success: false,
      message: 'You are not a member of this group.',
    });
  }

  // Fetch full details
  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      expenses: {
        orderBy: { date: 'desc' },
        include: {
          paidBy: {
            select: { id: true, name: true, email: true },
          },
          participants: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      },
      settlements: {
        orderBy: { date: 'desc' },
        include: {
          fromUser: {
            select: { id: true, name: true, email: true },
          },
          toUser: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      activityLogs: {
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!group) {
    return reply.status(404).send({
      success: false,
      message: 'Group not found.',
    });
  }

  // Dynamic balance calculations
  // We need to calculate: Paid, Owed, Sent, Received for each member
  const balancesMap: Record<string, {
    userId: string;
    name: string;
    email: string;
    totalPaid: number;
    totalOwed: number;
    settlementsSent: number;
    settlementsReceived: number;
    netBalance: number;
  }> = {};

  // Initialize for all members
  group.members.forEach(m => {
    balancesMap[m.userId] = {
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      totalPaid: 0,
      totalOwed: 0,
      settlementsSent: 0,
      settlementsReceived: 0,
      netBalance: 0,
    };
  });

  // 1. Accumulate paid expenses
  group.expenses.forEach(exp => {
    if (balancesMap[exp.paidById]) {
      balancesMap[exp.paidById].totalPaid += exp.amount;
    }
    // Accumulate shares owed
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

  // 3. Compute Net Balances
  const memberBalances = Object.values(balancesMap).map(member => {
    const netBalance = member.totalPaid - member.totalOwed + member.settlementsSent - member.settlementsReceived;
    return {
      ...member,
      netBalance: Math.round(netBalance * 100) / 100,
    };
  });

  // Calculate Group Total Expense
  const totalExpenses = group.expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return reply.status(200).send({
    success: true,
    group: {
      id: group.id,
      name: group.name,
      description: group.description,
      currency: group.currency,
      createdBy: group.createdBy,
      createdAt: group.createdAt,
      members: group.members.map(m => m.user),
      expenses: group.expenses,
      settlements: group.settlements,
      activityLogs: group.activityLogs,
      balances: memberBalances,
      totalExpenses,
    },
  });
}

export async function addMember(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id: groupId } = request.params as { id: string };
    const requesterId = request.user.id;
    const { email } = addMemberSchema.parse(request.body);

    const normalizedEmail = email.toLowerCase().trim();

    // Verify group exists & requestor is member
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: requesterId,
        },
      },
    });

    if (!membership) {
      return reply.status(403).send({
        success: false,
        message: 'You are not authorized to add members to this group.',
      });
    }

    // Find the user to add
    const userToAdd = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!userToAdd) {
      return reply.status(404).send({
        success: false,
        message: `User with email "${email}" not found. Ask them to register first!`,
      });
    }

    // Check if already a member
    const existingMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: userToAdd.id,
        },
      },
    });

    if (existingMember) {
      return reply.status(400).send({
        success: false,
        message: 'This user is already a member of the group.',
      });
    }

    // Add to group
    await prisma.$transaction(async (tx) => {
      await tx.groupMember.create({
        data: {
          groupId,
          userId: userToAdd.id,
        },
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          groupId,
          userId: requesterId,
          action: 'ADD_MEMBER',
          details: `added ${userToAdd.name} to the group`,
        },
      });

      // Create notification for user
      const groupInfo = await tx.group.findUnique({ where: { id: groupId } });
      await tx.notification.create({
        data: {
          userId: userToAdd.id,
          message: `You have been added to the group "${groupInfo?.name || 'Smart Splitting'}" by ${request.user.name}.`,
        },
      });
    });

    return reply.status(200).send({
      success: true,
      message: `${userToAdd.name} has been added to the group.`,
      user: {
        id: userToAdd.id,
        name: userToAdd.name,
        email: userToAdd.email,
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

export async function deleteGroup(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const userId = request.user.id;

  const group = await prisma.group.findUnique({
    where: { id },
  });

  if (!group) {
    return reply.status(404).send({
      success: false,
      message: 'Group not found.',
    });
  }

  // Only the creator can delete the group
  if (group.createdById !== userId) {
    return reply.status(403).send({
      success: false,
      message: 'Only the group creator can delete this group.',
    });
  }

  await prisma.group.delete({
    where: { id },
  });

  return reply.status(200).send({
    success: true,
    message: 'Group deleted successfully.',
  });
}
