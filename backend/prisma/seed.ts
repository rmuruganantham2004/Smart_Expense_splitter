import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clear database (order matters for foreign keys)
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.expenseParticipant.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();
  console.log('🧹 Cleaned existing tables.');

  // 2. Create Users
  const hashedPassword = await bcrypt.hash('password123', 10);

  const param = await prisma.user.create({
    data: { name: 'Param', email: 'param@example.com', password: hashedPassword },
  });
  const akash = await prisma.user.create({
    data: { name: 'Akash', email: 'akash@example.com', password: hashedPassword },
  });
  const rahul = await prisma.user.create({
    data: { name: 'Rahul', email: 'rahul@example.com', password: hashedPassword },
  });
  const vijay = await prisma.user.create({
    data: { name: 'Vijay', email: 'vijay@example.com', password: hashedPassword },
  });

  console.log(`👤 Created 4 users: Param, Akash, Rahul, Vijay`);

  // 3. Create Group
  const group = await prisma.group.create({
    data: {
      name: 'Goa Trip 🏖️',
      description: 'Expenses for our weekend getaway in Goa',
      currency: 'INR',
      createdById: param.id,
    },
  });
  console.log(`👥 Created group: "${group.name}"`);

  // 4. Add Members
  await prisma.groupMember.createMany({
    data: [
      { groupId: group.id, userId: param.id },
      { groupId: group.id, userId: akash.id },
      { groupId: group.id, userId: rahul.id },
      { groupId: group.id, userId: vijay.id },
    ],
  });
  console.log(`🔗 Linked members to group`);

  // 5. Create Activity Logs
  await prisma.activityLog.createMany({
    data: [
      { groupId: group.id, userId: param.id, action: 'CREATE_GROUP', details: 'created the group "Goa Trip 🏖️"' },
      { groupId: group.id, userId: param.id, action: 'ADD_MEMBER', details: 'added Akash to the group' },
      { groupId: group.id, userId: param.id, action: 'ADD_MEMBER', details: 'added Rahul to the group' },
      { groupId: group.id, userId: param.id, action: 'ADD_MEMBER', details: 'added Vijay to the group' },
    ],
  });

  // 6. Create Expenses
  // Expense 1: Param paid 1200 for Pizza (shared equally with Param, Akash, Rahul)
  // Split EQUAL: 1200 / 3 = 400 each
  const exp1 = await prisma.expense.create({
    data: {
      groupId: group.id,
      paidById: param.id,
      amount: 1200,
      description: 'Delicious Pizza Dinner 🍕',
      splitType: 'EQUAL',
      date: new Date(Date.now() - 48 * 3600 * 1000), // 2 days ago
    },
  });
  await prisma.expenseParticipant.createMany({
    data: [
      { expenseId: exp1.id, userId: param.id, shareAmount: 400, percentage: 33.33 },
      { expenseId: exp1.id, userId: akash.id, shareAmount: 400, percentage: 33.33 },
      { expenseId: exp1.id, userId: rahul.id, shareAmount: 400, percentage: 33.33 },
    ],
  });

  // Expense 2: Akash paid 500 for Cab (shared with Param and Akash)
  // Split EQUAL: 500 / 2 = 250 each
  const exp2 = await prisma.expense.create({
    data: {
      groupId: group.id,
      paidById: akash.id,
      amount: 500,
      description: 'Uber to Hotel 🚕',
      splitType: 'EQUAL',
      date: new Date(Date.now() - 24 * 3600 * 1000), // 1 day ago
    },
  });
  await prisma.expenseParticipant.createMany({
    data: [
      { expenseId: exp2.id, userId: param.id, shareAmount: 250, percentage: 50 },
      { expenseId: exp2.id, userId: akash.id, shareAmount: 250, percentage: 50 },
    ],
  });

  // Expense 3: Rahul paid 900 for Movie Tickets (shared with everyone)
  // Split EQUAL: 900 / 4 = 225 each
  const exp3 = await prisma.expense.create({
    data: {
      groupId: group.id,
      paidById: rahul.id,
      amount: 900,
      description: 'Cinema tickets 🍿',
      splitType: 'EQUAL',
      date: new Date(), // today
    },
  });
  await prisma.expenseParticipant.createMany({
    data: [
      { expenseId: exp3.id, userId: param.id, shareAmount: 225, percentage: 25 },
      { expenseId: exp3.id, userId: akash.id, shareAmount: 225, percentage: 25 },
      { expenseId: exp3.id, userId: rahul.id, shareAmount: 225, percentage: 25 },
      { expenseId: exp3.id, userId: vijay.id, shareAmount: 225, percentage: 25 },
    ],
  });

  console.log(`💵 Seeded 3 shared expenses`);

  // Log expense activities
  await prisma.activityLog.createMany({
    data: [
      { groupId: group.id, userId: param.id, action: 'ADD_EXPENSE', details: 'added expense "Delicious Pizza Dinner 🍕" for 1200' },
      { groupId: group.id, userId: akash.id, action: 'ADD_EXPENSE', details: 'added expense "Uber to Hotel 🚕" for 500' },
      { groupId: group.id, userId: rahul.id, action: 'ADD_EXPENSE', details: 'added expense "Cinema tickets 🍿" for 900' },
    ],
  });

  // 7. Seed one settlement
  // Let's say Vijay pays Rahul 100 towards settling their movie ticket balance
  const settle = await prisma.settlement.create({
    data: {
      groupId: group.id,
      fromId: vijay.id,
      toId: rahul.id,
      amount: 100,
    },
  });
  
  await prisma.activityLog.create({
    data: {
      groupId: group.id,
      userId: vijay.id,
      action: 'RECORD_SETTLEMENT',
      details: `recorded a settlement payment: Vijay paid Rahul 100`,
    },
  });

  await prisma.notification.create({
    data: {
      userId: rahul.id,
      message: `Vijay recorded a payment of 100 to settle their balance.`,
    },
  });

  console.log(`🤝 Seeded 1 settlement transaction`);
  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
