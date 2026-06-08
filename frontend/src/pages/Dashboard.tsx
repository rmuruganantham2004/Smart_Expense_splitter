import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { expenseService } from '../services/api';
import { Expense } from '../types/index';
import { Link } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  CurrencyDollarIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ReceiptPercentIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#ef4444'];

export default function Dashboard() {
  const { user, fetchGroups } = useAppStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stats, setStats] = useState({
    totalSpentInGroups: 0,
    amountPaidByYou: 0,
    yourTotalShare: 0,
    netBalance: 0,
  });
  const [loadingExpenses, setLoadingExpenses] = useState(true);

  const calculateStats = useCallback((allExpenses: Expense[]) => {
    let totalSpentInGroups = 0;
    let amountPaidByYou = 0;
    let yourTotalShare = 0;

    allExpenses.forEach((exp) => {
      totalSpentInGroups += exp.amount;
      
      if (exp.paidById === user?.id) {
        amountPaidByYou += exp.amount;
      }

      const myShare = exp.participants.find(p => p.userId === user?.id);
      if (myShare) {
        yourTotalShare += myShare.shareAmount;
      }
    });

    const netBalance = amountPaidByYou - yourTotalShare;

    setStats({
      totalSpentInGroups: Math.round(totalSpentInGroups * 100) / 100,
      amountPaidByYou: Math.round(amountPaidByYou * 100) / 100,
      yourTotalShare: Math.round(yourTotalShare * 100) / 100,
      netBalance: Math.round(netBalance * 100) / 100,
    });
  }, [user?.id]);

  const loadDashboardData = useCallback(async () => {
    setLoadingExpenses(true);
    try {
      const data = await expenseService.getExpenses();
      if (data.success) {
        setExpenses(data.expenses);
        calculateStats(data.expenses);
      }
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setLoadingExpenses(false);
    }
  }, [calculateStats]);

  useEffect(() => {
    fetchGroups();
    loadDashboardData();
  }, [fetchGroups, loadDashboardData]);


  // Group expenses by Month for BarChart
  const getMonthlyData = () => {
    const monthlyMap: Record<string, number> = {};
    const monthsOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Initialize last 6 months
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const label = `${monthsOrder[m.getMonth()]} ${m.getFullYear().toString().slice(-2)}`;
      monthlyMap[label] = 0;
    }

    expenses.forEach(exp => {
      const expDate = new Date(exp.date);
      const label = `${monthsOrder[expDate.getMonth()]} ${expDate.getFullYear().toString().slice(-2)}`;
      if (label in monthlyMap) {
        monthlyMap[label] += exp.amount;
      }
    });

    return Object.entries(monthlyMap).map(([month, amount]) => ({
      month,
      amount: Math.round(amount * 100) / 100,
    }));
  };

  // Group contributions by Payer for PieChart
  const getContributionsData = () => {
    const payerMap: Record<string, number> = {};
    expenses.forEach(exp => {
      const name = exp.paidBy.name;
      payerMap[name] = (payerMap[name] || 0) + exp.amount;
    });

    return Object.entries(payerMap).map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100,
    }));
  };

  const monthlyData = getMonthlyData();
  const contributionsData = getContributionsData();

  const isOwed = stats.netBalance >= 0;
  const absBalance = Math.abs(stats.netBalance);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">
            Hello, {user?.name}!
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Here is your financial status across all active splitting groups.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/ai-input"
            className="px-4 py-2.5 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-500/20 hover:bg-brand-500/20 font-medium transition-all duration-200 flex items-center gap-2"
          >
            <SparklesIcon className="w-5 h-5" />
            AI Text Parser
          </Link>
          <Link
            to="/groups"
            className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium shadow-md shadow-brand-500/20 transition-all duration-200 flex items-center gap-2"
          >
            <UserGroupIcon className="w-5 h-5" />
            My Groups
          </Link>
        </div>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Group Expenses */}
        <div className="glass-card p-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Group Spend</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <CurrencyDollarIcon className="w-6 h-6" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
            ₹{stats.totalSpentInGroups.toLocaleString()}
          </span>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Combined expense aggregate</p>
        </div>

        {/* Amount Paid By You */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Paid by You</span>
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-500">
              <ArrowTrendingUpIcon className="w-6 h-6" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
            ₹{stats.amountPaidByYou.toLocaleString()}
          </span>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Your cumulative paid output</p>
        </div>

        {/* Your Total Share */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Your Shares</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <ReceiptPercentIcon className="w-6 h-6" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
            ₹{stats.yourTotalShare.toLocaleString()}
          </span>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Value of your consumption</p>
        </div>

        {/* Net Balance */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Net Status</span>
            <div className={`p-2 rounded-xl ${isOwed ? 'bg-brand-500/10 text-brand-500' : 'bg-red-500/10 text-red-500'}`}>
              {isOwed ? <ArrowTrendingUpIcon className="w-6 h-6" /> : <ArrowTrendingDownIcon className="w-6 h-6" />}
            </div>
          </div>
          <span className={`text-2xl font-extrabold ${isOwed ? 'text-brand-500' : 'text-red-500'}`}>
            {isOwed ? '+' : '-'}₹{absBalance.toLocaleString()}
          </span>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            {isOwed ? 'You are owed in total' : 'You owe in total'}
          </p>
        </div>
      </div>

      {/* Main Charts & History section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Expenses Chart */}
        <div className="glass-card p-6 lg:col-span-2 flex flex-col min-h-[350px]">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6">
            Expense Volume per Month
          </h3>
          <div className="flex-1 w-full min-h-[240px]">
            {loadingExpenses ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
              </div>
            ) : expenses.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                No expense data recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Contributions Pie Chart */}
        <div className="glass-card p-6 flex flex-col min-h-[350px]">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6">
            Shares paid by Payer
          </h3>
          <div className="flex-1 w-full min-h-[220px] flex items-center justify-center">
            {loadingExpenses ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
            ) : expenses.length === 0 ? (
              <div className="text-slate-400">No contributors yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={contributionsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {contributionsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Bottom recent expenses summary */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between border-b pb-4 mb-5 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Recent Expense Ledger
          </h3>
          <Link to="/groups" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
            View groups to manage
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                <th className="py-2.5 font-semibold">Description</th>
                <th className="py-2.5 font-semibold">Group</th>
                <th className="py-2.5 font-semibold">Paid By</th>
                <th className="py-2.5 font-semibold">Split Type</th>
                <th className="py-2.5 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No transactions found. Add a group to get started!
                  </td>
                </tr>
              ) : (
                expenses.slice(0, 5).map((exp) => (
                  <tr key={exp.id} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/20 dark:hover:bg-slate-800/10">
                    <td className="py-3.5 font-medium text-slate-800 dark:text-slate-200">
                      {exp.description}
                    </td>
                    <td className="py-3.5 text-slate-500 dark:text-slate-400">
                      {exp.group?.name || 'N/A'}
                    </td>
                    <td className="py-3.5 text-slate-600 dark:text-slate-300">
                      {exp.paidBy.id === user?.id ? 'You' : exp.paidBy.name}
                    </td>
                    <td className="py-3.5">
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {exp.splitType}
                      </span>
                    </td>
                    <td className="py-3.5 font-bold text-slate-800 dark:text-slate-100 text-right">
                      ₹{exp.amount.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
