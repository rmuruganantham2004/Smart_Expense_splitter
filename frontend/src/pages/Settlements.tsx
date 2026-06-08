import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { settlementService } from '../services/api';
import { MemberBalance, OptimizedTransaction } from '../types/index';
import { ScaleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function Settlements() {
  const { groups, fetchGroups } = useAppStore();
  
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [balances, setBalances] = useState<MemberBalance[]>([]);
  const [optimizedSettlements, setOptimizedSettlements] = useState<OptimizedTransaction[]>([]);
  const [currency, setCurrency] = useState('INR');
  const [loading, setLoading] = useState(false);

  // Record settlement modal state
  const [showModal, setShowModal] = useState(false);
  const [settleFrom, setSettleFrom] = useState('');
  const [settleTo, setSettleTo] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleError, setSettleError] = useState('');
  const [settleSubmitting, setSettleSubmitting] = useState(false);

  const loadSettlements = useCallback(async (gId: string) => {
    setLoading(true);
    try {
      const data = await settlementService.getOptimizedSettlements(gId);
      if (data.success) {
        setBalances(data.balances);
        setOptimizedSettlements(data.optimizedSettlements);
        setCurrency(data.currency);
      }
    } catch (err) {
      console.error('Failed to load settlements for group:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    if (selectedGroupId) {
      loadSettlements(selectedGroupId);
    }
  }, [selectedGroupId, loadSettlements]);

  const triggerSettle = (fromId: string, toId: string, amount: number) => {
    setSettleFrom(fromId);
    setSettleTo(toId);
    setSettleAmount(String(amount));
    setSettleError('');
    setShowModal(true);
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettleError('');

    const amountNum = parseFloat(settleAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setSettleError('Please enter a valid positive amount.');
      return;
    }

    setSettleSubmitting(true);
    try {
      const data = await settlementService.createSettlement(selectedGroupId, {
        fromId: settleFrom,
        toId: settleTo,
        amount: amountNum,
      });
      if (data.success) {
        setShowModal(false);
        setSettleAmount('');
        await loadSettlements(selectedGroupId);
      }
    } catch (err: any) {
      setSettleError(err.response?.data?.message || 'Failed to record settlement payment.');
    } finally {
      setSettleSubmitting(false);
    }
  };

  const activeGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <ScaleIcon className="w-8 h-8 text-brand-500" />
          Settlement Optimization
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Minimize the number of transactions required to settle all group debts.
        </p>
      </div>

      <div className="glass-card p-6 max-w-xl">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Select Splitting Group
        </label>
        <select
          value={selectedGroupId}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedGroupId(val);
            if (!val) {
              setBalances([]);
              setOptimizedSettlements([]);
            }
          }}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 input-focus text-sm"
        >
          <option value="">-- Associate with a Group --</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name} ({g.currency})</option>
          ))}
        </select>
      </div>

      {selectedGroupId && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Node Balances */}
          <div className="glass-card p-6 md:col-span-2 space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 border-b pb-3 mb-2 dark:border-slate-800">
              Balances Status
            </h3>

            {loading ? (
              <div className="h-40 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500"></div>
              </div>
            ) : balances.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No member balance logs found.</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {balances.map(b => {
                  const balanceIsOwed = b.netBalance >= 0;
                  return (
                    <div key={b.userId} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/10">
                      <div>
                        <p className="font-bold text-slate-700 dark:text-slate-300">{b.name}</p>
                        <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{b.email}</span>
                      </div>
                      <span className={`font-extrabold ${balanceIsOwed ? 'text-brand-500' : 'text-red-500'}`}>
                        {balanceIsOwed ? '+' : '-'} {currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '€'}
                        {Math.abs(b.netBalance)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Optimized Transactions */}
          <div className="glass-card p-6 md:col-span-3 space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 border-b pb-3 mb-2 dark:border-slate-800">
              Optimized Settlement Plan
            </h3>

            {loading ? (
              <div className="h-40 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500"></div>
              </div>
            ) : optimizedSettlements.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center justify-center">
                <CheckCircleIcon className="w-12 h-12 text-brand-500 mb-2" />
                <h4 className="font-bold text-slate-800 dark:text-slate-100">Fully Settled</h4>
                <p className="text-xs text-slate-400 mt-1">No outstanding balances require settlements.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {optimizedSettlements.map((tx, idx) => (
                  <div key={idx} className="p-4 bg-brand-500/5 border border-brand-500/15 rounded-xl flex items-center justify-between gap-4">
                    <div className="text-xs">
                      <p className="text-slate-600 dark:text-slate-300">
                        <span className="font-bold text-slate-800 dark:text-slate-100">{tx.from.name}</span> pays{' '}
                        <span className="font-bold text-slate-800 dark:text-slate-100">{tx.to.name}</span>
                      </p>
                      <span className="font-black text-brand-600 dark:text-brand-400 text-base mt-1 block">
                        {currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '€'}
                        {tx.amount.toLocaleString()}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => triggerSettle(tx.from.id, tx.to.id, tx.amount)}
                      className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-md shadow-brand-500/20 active:scale-95 transition-all"
                    >
                      Record Payment
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Settlement Dialog Modal --- */}
      {showModal && activeGroup && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-md glass-card p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Record Settlement</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Log settlement payment in {activeGroup.name}.</p>

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
                    disabled
                  >
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
                    disabled
                  >
                    {activeGroup.members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Amount ({currency})</label>
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
                  onClick={() => setShowModal(false)}
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
