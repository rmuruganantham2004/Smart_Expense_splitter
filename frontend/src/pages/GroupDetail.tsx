import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { expenseService } from '../services/api';
import { 
  ArrowLeftIcon, PlusIcon, UserPlusIcon, 
  TrashIcon, PencilSquareIcon,
  ScaleIcon, DocumentTextIcon, ChartBarIcon
} from '@heroicons/react/24/outline';

type TabType = 'expenses' | 'members' | 'settlements' | 'activity';

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const { 
    user, 
    activeGroup, 
    fetchGroupDetail, 
    addMember, 
    optimizedSettlements, 
    fetchOptimizedSettlements,
    recordSettlement,
    loading 
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<TabType>('expenses');
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);

  // Member form state
  const [memberEmail, setMemberEmail] = useState('');
  const [memberError, setMemberError] = useState('');
  const [memberSuccess, setMemberSuccess] = useState('');
  const [memberSubmitting, setMemberSubmitting] = useState(false);

  // Expense form state
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePayer, setExpensePayer] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseSplitType, setExpenseSplitType] = useState<'EQUAL' | 'PERCENTAGE' | 'EXACT'>('EQUAL');
  const [expenseError, setExpenseError] = useState('');
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  
  // Custom split state
  // Map of userId -> checkbox checked, percentage value, exact amount value
  const [sharesState, setSharesState] = useState<Record<string, {
    checked: boolean;
    percentage: string;
    exact: string;
  }>>({});

  // Settlement form state
  const [settleFrom, setSettleFrom] = useState('');
  const [settleTo, setSettleTo] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleSubmitting, setSettleSubmitting] = useState(false);
  const [settleError, setSettleError] = useState('');

  const loadDetails = useCallback(async (groupId: string) => {
    await fetchGroupDetail(groupId);
    await fetchOptimizedSettlements(groupId);
  }, [fetchGroupDetail, fetchOptimizedSettlements]);

  useEffect(() => {
    if (id) {
      loadDetails(id);
    }
  }, [id, loadDetails]);

  // Initialize shares state when modal opens or members change
  const initSharesState = (existingExpense?: any) => {
    if (!activeGroup) return;

    const baseState: typeof sharesState = {};
    activeGroup.members.forEach(member => {
      // If editing expense, populate existing split values
      if (existingExpense) {
        const part = existingExpense.participants.find((p: any) => p.userId === member.id);
        baseState[member.id] = {
          checked: !!part,
          percentage: part?.percentage ? String(part.percentage) : '',
          exact: part?.shareAmount ? String(part.shareAmount) : '',
        };
      } else {
        // Default: everyone checked, equal shares
        baseState[member.id] = {
          checked: true,
          percentage: String(Math.round((100 / activeGroup.members.length) * 100) / 100),
          exact: '',
        };
      }
    });

    setSharesState(baseState);
  };

  const openNewExpenseModal = () => {
    setEditingExpenseId(null);
    setExpenseDesc('');
    setExpenseAmount('');
    setExpensePayer(user?.id || '');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setExpenseSplitType('EQUAL');
    setExpenseError('');
    setShowExpenseModal(true);
    setTimeout(() => initSharesState(), 50);
  };

  const openEditExpenseModal = (exp: any) => {
    setEditingExpenseId(exp.id);
    setExpenseDesc(exp.description);
    setExpenseAmount(String(exp.amount));
    setExpensePayer(exp.paidById);
    setExpenseDate(exp.date.split('T')[0]);
    setExpenseSplitType(exp.splitType);
    setExpenseError('');
    setShowExpenseModal(true);
    setTimeout(() => initSharesState(exp), 50);
  };

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError('');
    setMemberSuccess('');
    
    if (!id || !memberEmail.trim()) return;

    setMemberSubmitting(true);
    try {
      const msg = await addMember(id, memberEmail.toLowerCase().trim());
      setMemberSuccess(msg);
      setMemberEmail('');
      await loadDetails(id);
    } catch (err: any) {
      setMemberError(err.message || 'Failed to add member.');
    } finally {
      setMemberSubmitting(false);
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError('');

    if (!id) return;
    const amountNum = parseFloat(expenseAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setExpenseError('Please enter a valid expense amount.');
      return;
    }

    if (!expenseDesc.trim()) {
      setExpenseError('Please enter an expense description.');
      return;
    }

    // Prepare participants list based on split type
    const participantsList: any[] = [];
    const activeMembers = Object.entries(sharesState).filter(([, s]) => s.checked);

    if (activeMembers.length === 0) {
      setExpenseError('Please check at least one participant.');
      return;
    }

    if (expenseSplitType === 'EQUAL') {
      const perShare = amountNum / activeMembers.length;
      activeMembers.forEach(([mId]) => {
        participantsList.push({
          userId: mId,
          shareAmount: Math.round(perShare * 100) / 100,
        });
      });
    } else if (expenseSplitType === 'PERCENTAGE') {
      let pctSum = 0;
      activeMembers.forEach(([mId, s]) => {
        const pct = parseFloat(s.percentage) || 0;
        pctSum += pct;
        participantsList.push({
          userId: mId,
          shareAmount: Math.round((amountNum * pct) / 100 * 100) / 100,
          percentage: pct,
        });
      });

      if (Math.abs(pctSum - 100) > 0.1) {
        setExpenseError(`Percentage splits must sum to exactly 100%. Currently: ${pctSum}%`);
        return;
      }
    } else if (expenseSplitType === 'EXACT') {
      let exactSum = 0;
      activeMembers.forEach(([mId, s]) => {
        const amt = parseFloat(s.exact) || 0;
        exactSum += amt;
        participantsList.push({
          userId: mId,
          shareAmount: Math.round(amt * 100) / 100,
        });
      });

      if (Math.abs(exactSum - amountNum) > 0.05) {
        setExpenseError(`Exact splits must sum to the expense total (${amountNum}). Currently: ${exactSum}`);
        return;
      }
    }

    setExpenseSubmitting(true);
    try {
      const payload = {
        groupId: id,
        amount: amountNum,
        description: expenseDesc,
        paidById: expensePayer,
        date: new Date(expenseDate).toISOString(),
        splitType: expenseSplitType,
        participants: participantsList,
      };

      if (editingExpenseId) {
        await expenseService.updateExpense(editingExpenseId, payload);
      } else {
        await expenseService.createExpense(payload);
      }
      
      setShowExpenseModal(false);
      await loadDetails(id);
    } catch (err: any) {
      setExpenseError(err.response?.data?.message || 'Failed to save expense.');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await expenseService.deleteExpense(expenseId);
        if (id) await loadDetails(id);
      } catch {
        alert('Failed to delete expense.');
      }
    }
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettleError('');

    if (!id) return;
    const amountNum = parseFloat(settleAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setSettleError('Please enter a valid amount.');
      return;
    }

    if (!settleFrom || !settleTo || settleFrom === settleTo) {
      setSettleError('Select different sender and recipient.');
      return;
    }

    setSettleSubmitting(true);
    try {
      await recordSettlement(id, settleFrom, settleTo, amountNum);
      setShowSettleModal(false);
      setSettleAmount('');
    } catch (err: any) {
      setSettleError(err.response?.data?.message || 'Failed to record settlement payment.');
    } finally {
      setSettleSubmitting(false);
    }
  };

  const triggerQuickSettle = (fromId: string, toId: string, amount: number) => {
    setSettleFrom(fromId);
    setSettleTo(toId);
    setSettleAmount(String(amount));
    setSettleError('');
    setShowSettleModal(true);
  };

  const exportCSV = () => {
    if (!activeGroup) return;
    
    // Header
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Date,Description,Paid By,Split Type,Total Amount,Your Share\n';
    
    activeGroup.expenses.forEach(exp => {
      const myShare = exp.participants.find(p => p.userId === user?.id)?.shareAmount || 0;
      const row = [
        new Date(exp.date).toLocaleDateString(),
        `"${exp.description.replace(/"/g, '""')}"`,
        exp.paidBy.name,
        exp.splitType,
        exp.amount,
        myShare
      ].join(',');
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${activeGroup.name.replace(/\s+/g, '_')}_expenses.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !activeGroup) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!activeGroup) {
    return (
      <div className="text-center py-12 glass-card max-w-md mx-auto mt-12">
        <h3 className="text-lg font-bold text-red-500">Group not found</h3>
        <p className="text-slate-500 mt-2">The group does not exist or you do not have permission to view it.</p>
        <Link to="/groups" className="mt-6 inline-flex items-center gap-2 text-brand-600 font-semibold hover:underline">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Groups
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
      
      {/* --- Left Column: Main Tabs and Listings --- */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Header navigation back link */}
        <div className="flex items-center justify-between border-b pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Link to="/groups" className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all text-slate-600 dark:text-slate-400">
              <ArrowLeftIcon className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
                {activeGroup.name}
              </h1>
              {activeGroup.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{activeGroup.description}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              title="Download CSV report"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40 text-sm font-medium flex items-center gap-2"
            >
              <DocumentTextIcon className="w-5 h-5" />
              CSV
            </button>
            <Link
              to={`/groups/${activeGroup.id}/graph`}
              title="Interactive debt map"
              className="px-3.5 py-2 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/20 hover:bg-purple-500/20 text-sm font-medium flex items-center gap-2"
            >
              <ChartBarIcon className="w-5 h-5" />
              Debt Graph
            </Link>
            <button
              onClick={openNewExpenseModal}
              className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold shadow-md shadow-brand-500/25 flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Add Expense
            </button>
          </div>
        </div>

        {/* Custom tabs toggles */}
        <div className="flex border-b dark:border-slate-800">
          {(['expenses', 'members', 'settlements', 'activity'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 font-semibold text-sm capitalize border-b-2 -mb-[2px] transition-all ${
                activeTab === tab 
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400' 
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab === 'expenses' ? 'Expense ledger' : tab === 'members' ? 'Members & balances' : tab}
            </button>
          ))}
        </div>

        {/* --- Tab 1: Expenses --- */}
        {activeTab === 'expenses' && (
          <div className="space-y-4">
            {activeGroup.expenses.length === 0 ? (
              <div className="text-center py-12 glass-card">
                <p className="text-slate-400 dark:text-slate-500">No expenses recorded. Click "Add Expense" to get started.</p>
              </div>
            ) : (
              activeGroup.expenses.map((exp) => (
                <div key={exp.id} className="glass-card p-5 hover:border-slate-200 dark:hover:border-slate-800 transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div className="flex items-start gap-4">
                    <div className="text-center px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 min-w-[55px]">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">
                        {new Date(exp.date).toLocaleDateString([], { month: 'short' })}
                      </span>
                      <span className="block text-xl font-extrabold text-slate-700 dark:text-slate-300 -mt-1">
                        {new Date(exp.date).getDate()}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100">{exp.description}</h4>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        Paid by <span className="font-semibold">{exp.paidBy.id === user?.id ? 'You' : exp.paidBy.name}</span> • Split {exp.splitType.toLowerCase()}
                      </p>
                      
                      {/* Sub-participants shares list on hover or small font */}
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {exp.participants.map(p => (
                          <span key={p.id} className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            {p.user.name}: {activeGroup.currency === 'INR' ? '₹' : activeGroup.currency === 'USD' ? '$' : '€'}{p.shareAmount}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-3">
                    <div className="text-right">
                      <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide font-semibold block">Total Cost</span>
                      <span className="font-black text-slate-800 dark:text-slate-100 text-lg">
                        {activeGroup.currency === 'INR' ? '₹' : activeGroup.currency === 'USD' ? '$' : '€'}
                        {exp.amount.toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditExpenseModal(exp)}
                        className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500"
                        title="Edit Expense"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-500"
                        title="Delete Expense"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* --- Tab 2: Members & Balances --- */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            {activeGroup.balances.map((mb) => {
              const balanceIsOwed = mb.netBalance >= 0;
              return (
                <div key={mb.userId} className="glass-card p-5 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100">{mb.name}</h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{mb.email}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-2 font-medium">
                      <span>Paid: {activeGroup.currency === 'INR' ? '₹' : activeGroup.currency === 'USD' ? '$' : '€'}{mb.totalPaid}</span>
                      <span>•</span>
                      <span>Owes: {activeGroup.currency === 'INR' ? '₹' : activeGroup.currency === 'USD' ? '$' : '€'}{mb.totalOwed}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-semibold uppercase tracking-wide">Net Balance</span>
                    <span className={`font-black text-lg ${balanceIsOwed ? 'text-brand-500' : 'text-red-500'}`}>
                      {balanceIsOwed ? '+' : '-'} {activeGroup.currency === 'INR' ? '₹' : activeGroup.currency === 'USD' ? '$' : '€'}
                      {Math.abs(mb.netBalance)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* --- Tab 3: Settlements --- */}
        {activeTab === 'settlements' && (
          <div className="space-y-4">
            {activeGroup.settlements.length === 0 ? (
              <div className="text-center py-12 glass-card">
                <p className="text-slate-400 dark:text-slate-500">No settlement payments recorded yet.</p>
              </div>
            ) : (
              activeGroup.settlements.map((settle) => (
                <div key={settle.id} className="glass-card p-5 flex items-center justify-between border-l-4 border-brand-500">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
                      ✓
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-100">
                        {settle.fromUser.name} paid {settle.toUser.name}
                      </p>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                        {new Date(settle.date).toLocaleDateString([], { dateStyle: 'medium' })}
                      </span>
                    </div>
                  </div>
                  <span className="font-black text-lg text-brand-500">
                    {activeGroup.currency === 'INR' ? '₹' : activeGroup.currency === 'USD' ? '$' : '€'}
                    {settle.amount.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* --- Tab 4: Activity Feed --- */}
        {activeTab === 'activity' && (
          <div className="glass-card p-6 space-y-4">
            {activeGroup.activityLogs.length === 0 ? (
              <p className="text-center text-slate-400 py-8">No recent activities</p>
            ) : (
              <div className="flow-root">
                <ul className="-mb-8">
                  {activeGroup.activityLogs.map((log, idx) => (
                    <li key={log.id}>
                      <div className="relative pb-8">
                        {idx !== activeGroup.activityLogs.length - 1 ? (
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-semibold">
                              {log.user.name.charAt(0)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-xs text-slate-600 dark:text-slate-300">
                                <span className="font-bold text-slate-800 dark:text-slate-100">{log.user.name}</span>{' '}
                                {log.details}
                              </p>
                            </div>
                            <div className="text-right text-[10px] text-slate-400 whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      </div>

      {/* --- Right Column: Settlements and Members widgets --- */}
      <div className="space-y-6">
        
        {/* Members Management Widget */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b pb-3 mb-4 dark:border-slate-800">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <UserPlusIcon className="w-5 h-5 text-brand-500" />
                Group Members ({activeGroup.members.length})
              </h3>
              <button
                onClick={() => {
                  setMemberError('');
                  setMemberSuccess('');
                  setShowMemberModal(true);
                }}
                className="p-1 text-brand-600 hover:text-brand-700 dark:text-brand-400"
                title="Add Group Member"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3.5 max-h-48 overflow-y-auto">
              {activeGroup.members.map(member => (
                <div key={member.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center font-bold text-xs">
                      {member.name.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{member.name}</span>
                      <span className="text-[10px] text-slate-400 truncate max-w-[130px]">{member.email}</span>
                    </div>
                  </div>
                  {member.id === activeGroup.createdBy.id && (
                    <span className="text-[9px] bg-brand-500/10 text-brand-600 font-bold px-1.5 py-0.5 rounded">Owner</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Settlement Optimization Widget */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b pb-3 mb-4 dark:border-slate-800">
              <ScaleIcon className="w-5 h-5 text-brand-500" />
              Optimized Settlements
            </h3>

            {optimizedSettlements.length === 0 ? (
              <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
                ✨ Everything is settled up! Zero balances outstanding.
              </div>
            ) : (
              <div className="space-y-3.5">
                {optimizedSettlements.map((tx, idx) => (
                  <div key={idx} className="p-3 bg-slate-100/55 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs gap-3">
                    <div className="min-w-0">
                      <p className="text-slate-500 dark:text-slate-400">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{tx.from.name}</span> owes{' '}
                        <span className="font-bold text-slate-700 dark:text-slate-200">{tx.to.name}</span>
                      </p>
                      <span className="font-black text-brand-600 dark:text-brand-400 text-sm mt-0.5 block">
                        {activeGroup.currency === 'INR' ? '₹' : activeGroup.currency === 'USD' ? '$' : '€'}
                        {tx.amount.toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={() => triggerQuickSettle(tx.from.id, tx.to.id, tx.amount)}
                      className="px-2.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold flex items-center gap-1 scale-95 hover:scale-100 active:scale-95 transition-all"
                    >
                      Settle
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* --- Add Member Modal Dialog --- */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-md glass-card p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Add Member</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Users must be registered in Smart Splitter to be added.</p>
            
            {memberError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs text-center">
                {memberError}
              </div>
            )}

            {memberSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-xs text-center">
                {memberSuccess}
              </div>
            )}

            <form onSubmit={handleMemberSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">User Email Address</label>
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="friend@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-slate-800 dark:text-slate-100 input-focus text-sm"
                  disabled={memberSubmitting}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  disabled={memberSubmitting}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-all"
                  disabled={memberSubmitting}
                >
                  {memberSubmitting ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Add / Edit Expense Drawer Modal --- */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-end z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-lg h-full bg-white dark:bg-slate-900 shadow-2xl p-6 overflow-y-auto flex flex-col justify-between animate-in slide-in-from-right duration-300">
            <div>
              <div className="flex items-center justify-between border-b pb-4 mb-6 dark:border-slate-800">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                  {editingExpenseId ? 'Edit Expense details' : 'Record Shared Expense'}
                </h3>
                <button 
                  onClick={() => setShowExpenseModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              {expenseError && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs text-center">
                  {expenseError}
                </div>
              )}

              <form onSubmit={handleExpenseSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Description</label>
                    <input
                      type="text"
                      value={expenseDesc}
                      onChange={(e) => setExpenseDesc(e.target.value)}
                      placeholder="Pizza, Gas bill, Uber ride"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-slate-800 dark:text-slate-100 input-focus text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Amount ({activeGroup.currency})</label>
                    <input
                      type="number"
                      step="any"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-slate-800 dark:text-slate-100 input-focus text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Paid By</label>
                    <select
                      value={expensePayer}
                      onChange={(e) => setExpensePayer(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-905/30 text-slate-800 dark:text-slate-100 input-focus text-sm"
                    >
                      {activeGroup.members.map(m => (
                        <option key={m.id} value={m.id}>{m.id === user?.id ? 'You' : m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Date</label>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-slate-800 dark:text-slate-100 input-focus text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Split Strategy</label>
                  <div className="flex gap-2">
                    {(['EQUAL', 'PERCENTAGE', 'EXACT'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setExpenseSplitType(type)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border capitalize transition-all ${
                          expenseSplitType === type 
                            ? 'bg-brand-500 border-brand-500 text-white shadow' 
                            : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {type.toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Splitting shares checklist container */}
                <div className="border border-slate-100 dark:border-slate-800/80 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 border-b pb-2 dark:border-slate-800">
                    <span>Member</span>
                    <span>Split weight</span>
                  </div>

                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {activeGroup.members.map(member => {
                      const share = sharesState[member.id] || { checked: false, percentage: '', exact: '' };
                      return (
                        <div key={member.id} className="flex items-center justify-between gap-3 text-sm">
                          <label className="flex items-center gap-2 cursor-pointer min-w-0">
                            <input
                              type="checkbox"
                              checked={share.checked}
                              onChange={(e) => {
                                setSharesState({
                                  ...sharesState,
                                  [member.id]: { ...share, checked: e.target.checked }
                                });
                              }}
                              className="rounded text-brand-500 focus:ring-brand-500 w-4 h-4"
                            />
                            <span className="truncate text-slate-700 dark:text-slate-300">{member.name}</span>
                          </label>

                          {share.checked && (
                            <div className="w-24">
                              {expenseSplitType === 'PERCENTAGE' && (
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={share.percentage}
                                    onChange={(e) => {
                                      setSharesState({
                                        ...sharesState,
                                        [member.id]: { ...share, percentage: e.target.value }
                                      });
                                    }}
                                    className="w-full px-2 py-1 text-right text-xs border rounded-lg pr-5 dark:bg-slate-900"
                                    placeholder="0"
                                  />
                                  <span className="absolute right-1.5 top-1.5 text-[10px] text-slate-400">%</span>
                                </div>
                              )}
                              {expenseSplitType === 'EXACT' && (
                                <div className="relative">
                                  <span className="absolute left-1.5 top-1.5 text-[10px] text-slate-400">₹</span>
                                  <input
                                    type="number"
                                    value={share.exact}
                                    onChange={(e) => {
                                      setSharesState({
                                        ...sharesState,
                                        [member.id]: { ...share, exact: e.target.value }
                                      });
                                    }}
                                    className="w-full px-2 py-1 text-right text-xs border rounded-lg pl-5 dark:bg-slate-900"
                                    placeholder="0.00"
                                  />
                                </div>
                              )}
                              {expenseSplitType === 'EQUAL' && (
                                <span className="text-xs text-slate-400 block text-right font-medium">Equal Split</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </form>
            </div>

            <div className="flex gap-3 pt-6 border-t dark:border-slate-800 mt-6">
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 text-sm transition-all"
                disabled={expenseSubmitting}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleExpenseSubmit}
                className="flex-1 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-all"
                disabled={expenseSubmitting}
              >
                {expenseSubmitting ? 'Saving...' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Settlement Modal Dialog --- */}
      {showSettleModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-md glass-card p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Record Payment</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Log cash or bank settlements between members.</p>

            {settleError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs text-center">
                {settleError}
              </div>
            )}

            <form onSubmit={handleSettleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Sender (Payer)</label>
                  <select
                    value={settleFrom}
                    onChange={(e) => setSettleFrom(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 input-focus text-xs"
                    disabled={settleSubmitting}
                  >
                    <option value="">Choose Payer</option>
                    {activeGroup.members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Recipient (Receiver)</label>
                  <select
                    value={settleTo}
                    onChange={(e) => setSettleTo(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 input-focus text-xs"
                    disabled={settleSubmitting}
                  >
                    <option value="">Choose Recipient</option>
                    {activeGroup.members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Amount ({activeGroup.currency})</label>
                <input
                  type="number"
                  step="any"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-slate-800 dark:text-slate-100 input-focus text-sm"
                  disabled={settleSubmitting}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSettleModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  disabled={settleSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-all"
                  disabled={settleSubmitting}
                >
                  {settleSubmitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
