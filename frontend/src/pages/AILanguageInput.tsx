import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { aiService, expenseService } from '../services/api';
import { SparklesIcon, CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function AILanguageInput() {
  const { groups, fetchGroups } = useAppStore();
  const [inputText, setInputText] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // Parsed details review state
  const [parsedDraft, setParsedDraft] = useState<any | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleParse = async () => {
    setError('');
    setSuccess('');
    setParsedDraft(null);

    if (!inputText.trim()) {
      setError('Please enter some text describing the expense.');
      return;
    }

    setParsing(true);
    try {
      const data = await aiService.parseExpense(inputText, selectedGroupId || undefined);
      if (data.success && data.parsed) {
        setParsedDraft(data.parsed);
      } else {
        setError('Could not extract structured data. Try a clearer sentence.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'AI parsing error. Check OpenAI key or text formatting.');
    } finally {
      setParsing(false);
    }
  };

  const handleSaveDraft = async () => {
    setError('');
    setSuccess('');

    if (!selectedGroupId) {
      setError('Please select a target group to save this expense.');
      return;
    }

    if (!parsedDraft) return;

    // Find the selected group details to resolve user IDs
    const targetGroup = groups.find(g => g.id === selectedGroupId);
    if (!targetGroup) {
      setError('Selected group not found.');
      return;
    }

    // Match payer name with group members (case insensitive)
    const payerName = parsedDraft.payer;
    const matchedPayer = targetGroup.members.find(
      m => m.name.toLowerCase() === payerName.toLowerCase()
    );

    if (!matchedPayer) {
      setError(`Payer "${payerName}" is not a member of the selected group. Add them to the group first.`);
      return;
    }

    // Match participants with group members
    const parsedParticipants = parsedDraft.participants;
    const participantsList: any[] = [];
    const missingParticipants: string[] = [];

    parsedParticipants.forEach((pName: string) => {
      const match = targetGroup.members.find(
        m => m.name.toLowerCase() === pName.toLowerCase()
      );
      if (match) {
        participantsList.push({ userId: match.id });
      } else {
        missingParticipants.push(pName);
      }
    });

    if (missingParticipants.length > 0) {
      setError(`Participants: ${missingParticipants.join(', ')} are not in the group. Add them first.`);
      return;
    }

    // Default split EQUAL: calculate shareAmount
    const count = participantsList.length;
    const perShare = parsedDraft.amount / count;
    const finalizedParticipants = participantsList.map(p => ({
      userId: p.userId,
      shareAmount: Math.round(perShare * 100) / 100,
    }));

    setSaving(true);
    try {
      await expenseService.createExpense({
        groupId: selectedGroupId,
        amount: parsedDraft.amount,
        description: parsedDraft.description,
        paidById: matchedPayer.id,
        splitType: 'EQUAL',
        participants: finalizedParticipants,
      });

      setSuccess('Expense added successfully from AI parsing!');
      setInputText('');
      setParsedDraft(null);
      
      // Redirect to group details
      setTimeout(() => {
        navigate(`/groups/${selectedGroupId}`);
      }, 1500);

    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save parsed expense.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <SparklesIcon className="w-8 h-8 text-brand-500" />
          AI Expense Parser
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Type expenses in plain English and save them instantly without manual splitting forms.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-sm flex items-start gap-3">
          <CheckIcon className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        
        {/* Input panel (left/top) */}
        <div className="glass-card p-6 md:col-span-3 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Select Splitting Group
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 input-focus text-sm"
            >
              <option value="">-- Associate with a Group --</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name} ({g.currency})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Describe Expense
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Example:
Param paid 1200 for pizza shared with Param, Akash and Rahul.
- or -
Vijay spent 450 on Uber ride shared with Rahul.`}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 input-focus text-sm min-h-[160px]"
            />
          </div>

          <button
            onClick={handleParse}
            disabled={parsing || !inputText.trim()}
            className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold transition-all shadow-md shadow-brand-500/20 flex items-center justify-center gap-2"
          >
            {parsing ? 'Analyzing plain text...' : 'Parse Expense Details'}
          </button>
        </div>

        {/* Review panel (right/bottom) */}
        <div className="md:col-span-2 space-y-4">
          <div className="glass-card p-6 min-h-[300px] flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 border-b pb-3 mb-4 dark:border-slate-800 flex items-center gap-2">
                Parsed Structure Draft
              </h3>
              
              {!parsedDraft ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs">
                  Type description on the left and click parse to generate a draft.
                </div>
              ) : (
                <div className="space-y-4 text-sm">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Description</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-base">{parsedDraft.description}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Payer Name</span>
                    <span className="font-bold text-brand-600 dark:text-brand-400">{parsedDraft.payer}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Total Amount</span>
                    <span className="font-black text-slate-800 dark:text-slate-100 text-lg">₹{parsedDraft.amount}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Participants</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {parsedDraft.participants.map((p: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {parsedDraft && (
              <div className="pt-6 border-t dark:border-slate-800 mt-6 space-y-3">
                <button
                  onClick={handleSaveDraft}
                  disabled={saving || !selectedGroupId}
                  className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold transition-all text-xs flex items-center justify-center gap-1 shadow-md"
                >
                  {saving ? 'Saving...' : 'Confirm & Save to Group'}
                </button>
                {!selectedGroupId && (
                  <p className="text-[10px] text-center text-red-500">Associate a group above to save.</p>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
