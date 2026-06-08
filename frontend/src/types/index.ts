export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  currency: string;
  createdBy: { id: string; name: string };
  createdAt: string;
  membersCount: number;
  members: User[];
  totalExpenses: number;
}

export interface MemberBalance {
  userId: string;
  name: string;
  email: string;
  totalPaid: number;
  totalOwed: number;
  settlementsSent: number;
  settlementsReceived: number;
  netBalance: number;
}

export interface ExpenseParticipant {
  id: string;
  expenseId: string;
  userId: string;
  shareAmount: number;
  percentage?: number | null;
  user: { id: string; name: string; email: string };
}

export interface Expense {
  id: string;
  groupId: string;
  paidById: string;
  paidBy: { id: string; name: string; email: string };
  amount: number;
  description: string;
  date: string;
  splitType: 'EQUAL' | 'PERCENTAGE' | 'EXACT';
  participants: ExpenseParticipant[];
  group?: { id: string; name: string; currency: string };
}

export interface Settlement {
  id: string;
  groupId: string;
  fromId: string;
  fromUser: { id: string; name: string; email: string };
  toId: string;
  toUser: { id: string; name: string; email: string };
  amount: number;
  date: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  groupId?: string | null;
  userId: string;
  user: { id: string; name: string };
  action: string;
  details: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  description?: string;
  currency: string;
  createdBy: { id: string; name: string; email: string };
  createdAt: string;
  members: User[];
  expenses: Expense[];
  settlements: Settlement[];
  activityLogs: ActivityLog[];
  balances: MemberBalance[];
  totalExpenses: number;
}

export interface OptimizedTransaction {
  from: {
    id: string;
    name: string;
    email: string;
  };
  to: {
    id: string;
    name: string;
    email: string;
  };
  amount: number;
}

export interface ParsedExpense {
  payer: string;
  amount: number;
  description: string;
  participants: string[];
}
