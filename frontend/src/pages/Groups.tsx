import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Link } from 'react-router-dom';
import { 
  PlusIcon, UserGroupIcon, FolderOpenIcon, TrashIcon 
} from '@heroicons/react/24/outline';

export default function Groups() {
  const { groups, fetchGroups, createGroup, deleteGroup, loading } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Group name is required.');
      return;
    }

    setSubmitting(true);
    try {
      await createGroup(name, description, currency);
      setName('');
      setDescription('');
      setCurrency('INR');
      setShowModal(false);
    } catch {
      setError('Failed to create group. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (groupId: string, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating
    if (window.confirm('Are you sure you want to delete this group? This will delete all members, expenses, and settlements.')) {
      try {
        await deleteGroup(groupId);
      } catch (err: any) {
        alert(err.response?.data?.message || 'Failed to delete group.');
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">
            My Splitting Groups
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Organize trips, house splits, and shared bills with friends.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium shadow-md shadow-brand-500/20 transition-all duration-200 flex items-center gap-2 active:scale-95"
        >
          <PlusIcon className="w-5 h-5" />
          Create Group
        </button>
      </div>

      {loading && groups.length === 0 ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
      ) : groups.length === 0 ? (
        <div className="glass-card p-12 text-center flex flex-col items-center justify-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-4">
            <UserGroupIcon className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">No Groups Found</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-2 mb-6 text-sm">
            Create a group to start splitting dinner bills, rent, and vacations with your crew!
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium transition-all"
          >
            Get Started
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((g) => (
            <Link
              key={g.id}
              to={`/groups/${g.id}`}
              className="glass-card p-6 flex flex-col justify-between hover:translate-y-[-4px] hover:border-brand-500/30 group transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">
                    {g.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400 uppercase">
                    {g.currency}
                  </span>
                </div>
                
                {g.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                    {g.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500 mt-2">
                  <span className="flex items-center gap-1">
                    <UserGroupIcon className="w-4 h-4 text-slate-500" />
                    {g.membersCount} member{g.membersCount > 1 ? 's' : ''}
                  </span>
                  <span>•</span>
                  <span>Created by {g.createdBy.name}</span>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800/60 pt-4 mt-5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-semibold uppercase tracking-wide">Group Spend</span>
                  <span className="font-extrabold text-slate-700 dark:text-slate-300">
                    {g.currency === 'INR' ? '₹' : g.currency === 'USD' ? '$' : '€'}
                    {g.totalExpenses.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleDelete(g.id, e)}
                    title="Delete Group"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                  <span className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-brand-500 group-hover:text-white transition-all">
                    <FolderOpenIcon className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* --- Create Group Modal Dialog --- */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-md glass-card p-6 shadow-2xl relative overflow-hidden">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Create New Group</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Group up with friends to split everything automatically.</p>
            
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Group Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Trip to Goa, Apartment Rent, Dinner split"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-slate-800 dark:text-slate-100 input-focus text-sm"
                  disabled={submitting}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details about the group expenses..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-slate-800 dark:text-slate-100 input-focus text-sm min-h-[80px]"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Currency Code</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 input-focus text-sm"
                  disabled={submitting}
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-all"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
