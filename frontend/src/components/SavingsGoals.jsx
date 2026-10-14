import { useState, useEffect } from 'react';
import { getGoals, createGoal, contributeToGoal, withdrawFromGoal, deleteGoal } from '../api/goals';
import ConfirmDialog from './ConfirmDialog';
import LeftoverSplit from './LeftoverSplit';
import { Flag, Plus, Minus, Loader2, Trash2, Check, CalendarDays, Info, Wallet, AlertCircle, Sparkles } from 'lucide-react';

/* ---------- helpers ---------- */

function formatINR(amount) {
  const n = Number(amount || 0);
  return `${n < 0 ? '-' : ''}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatMonthLabel(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeLeftLabel(goal) {
  if (goal.daysLeft === 0) return 'Due today';
  if (goal.daysLeft <= 30) return `${goal.daysLeft} ${goal.daysLeft === 1 ? 'day' : 'days'} left`;
  return `${goal.monthsLeft} ${goal.monthsLeft === 1 ? 'month' : 'months'} left`;
}

function errorText(err) {
  const data = err.response?.data;
  if (typeof data === 'string' && data) return data;
  return err.message || 'Something went wrong.';
}

const STATUS = {
  ACHIEVED: {
    label: 'Achieved',
    pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
  ON_TRACK: {
    label: 'On track',
    pill: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    bar: 'bg-primary',
  },
  BEHIND: {
    label: 'Behind',
    pill: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
  OVERDUE: {
    label: 'Overdue',
    pill: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    bar: 'bg-rose-500',
  },
};

const INPUT_CLASS =
  'w-full border border-gray-300 dark:border-gray-600 bg-card text-text rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition shadow-sm';

/* ---------- one goal card ---------- */

function GoalCard({ goal, onContribute, onWithdraw, onDelete }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(null);
  const [cardError, setCardError] = useState(null);

  const status = STATUS[goal.status] || STATUS.ON_TRACK;
  const achieved = goal.status === 'ACHIEVED';
  const dueSoon = goal.daysLeft <= 30;
  const canWithdraw = Number(goal.savedAmount) > 0;

  const run = async (kind) => {
    const value = Number(amount);

    if (!amount || value <= 0) {
      setCardError('Enter an amount above zero.');
      return;
    }
    if (kind === 'add' && value > Number(goal.remaining)) {
      setCardError(`Only ${formatINR(goal.remaining)} is left to reach this goal.`);
      return;
    }
    if (kind === 'withdraw' && value > Number(goal.savedAmount)) {
      setCardError(`You only have ${formatINR(goal.savedAmount)} saved in this goal.`);
      return;
    }

    setBusy(kind);
    setCardError(null);
    try {
      await (kind === 'add' ? onContribute : onWithdraw)(goal.id, value);
      setAmount('');
    } catch (err) {
      setCardError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!achieved) run('add');
  };

  return (
    <div
      className={`rounded-xl p-4 space-y-3 border ${
        achieved
          ? 'bg-emerald-50/60 dark:bg-emerald-500/5 border-emerald-300 dark:border-emerald-500/40'
          : 'bg-bg border-gray-200/60 dark:border-gray-700/60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text truncate">{goal.name}</h3>
          <p className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
            <CalendarDays size={13} />
            <span>
              Target {formatDate(goal.targetDate)}
              {goal.status !== 'ACHIEVED' && goal.status !== 'OVERDUE' && <> · {timeLeftLabel(goal)}</>}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${status.pill}`}>{status.label}</span>
          <button
            onClick={() => onDelete(goal)}
            aria-label="Delete goal"
            title="Delete goal"
            className="p-1.5 rounded-lg text-gray-400 hover:text-danger hover:bg-card transition"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div>
        <div className="h-2.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${status.bar}`}
            style={{ width: `${Math.min(Number(goal.progressPercent), 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          {formatINR(goal.savedAmount)} of {formatINR(goal.targetAmount)} ({goal.progressPercent}%)
        </p>
      </div>

      <div className="text-sm text-text space-y-1">
        {achieved && (
          <p className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-300">
            <Check size={16} /> Goal reached. You saved {formatINR(goal.savedAmount)}.
          </p>
        )}

        {goal.status === 'OVERDUE' && (
          <p>The target date has passed with {formatINR(goal.remaining)} still to go.</p>
        )}

        {(goal.status === 'ON_TRACK' || goal.status === 'BEHIND') && (
          <p>
            Save <span className="font-semibold">{formatINR(goal.requiredPerMonth)}</span>{' '}
            {dueSoon ? `by ${formatDate(goal.targetDate)}.` : 'a month to get there.'}
          </p>
        )}

        {goal.status === 'BEHIND' && (
          <p className="text-gray-400 text-xs">
            You are about {formatINR(goal.shortfallPerMonth)}{dueSoon ? '' : ' a month'} short for this one.
          </p>
        )}
      </div>

      {(!achieved || canWithdraw) && (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-400">₹</span>
          <input
            type="number"
            min="0"
            placeholder="Amount"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setCardError(null); }}
            className="w-28 sm:w-36 border border-gray-300 dark:border-gray-600 bg-card text-text rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
          />
          {!achieved && (
            <button
              type="submit"
              disabled={busy !== null}
              className="bg-primary text-white px-3.5 py-1.5 rounded-lg text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy === 'add' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              <span>Add</span>
            </button>
          )}
          {canWithdraw && (
            <button
              type="button"
              onClick={() => run('withdraw')}
              disabled={busy !== null}
              title="Record money you used from this goal"
              className="border border-gray-300 dark:border-gray-600 text-text px-3.5 py-1.5 rounded-lg text-sm font-semibold hover:bg-card active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy === 'withdraw' ? <Loader2 size={14} className="animate-spin" /> : <Minus size={14} />}
              <span>Withdraw</span>
            </button>
          )}
        </form>
      )}

      {cardError && <p className="text-xs font-semibold text-danger">{cardError}</p>}
    </div>
  );
}

/* ---------- main section ---------- */

function SavingsGoals({ refreshKey, onTotalSavedChange }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false); // Modal state for leftover split on command
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [saved, setSaved] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState(null);

  const [deletingGoal, setDeletingGoal] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getGoals()
      .then((data) => {
        if (!cancelled) {
          setOverview(data);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorText(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  useEffect(() => {
    if (!overview || !onTotalSavedChange) return;
    const total = (overview.goals ?? []).reduce((sum, g) => sum + Number(g.savedAmount), 0);
    onTotalSavedChange(total);
  }, [overview, onTotalSavedChange]);

  const handleCreate = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setFormError('Give your goal a name.');
      return;
    }
    if (!target || Number(target) <= 0) {
      setFormError('Enter a target amount above zero.');
      return;
    }
    if (!targetDate) {
      setFormError('Pick a target date.');
      return;
    }
    if (saved && Number(saved) > Number(target)) {
      setFormError('Already saved cannot be more than the target amount.');
      return;
    }

    setCreating(true);
    setFormError(null);
    try {
      const data = await createGoal({
        name: name.trim(),
        targetAmount: Number(target),
        targetDate,
        savedAmount: saved ? Number(saved) : 0,
      });
      setOverview(data);
      setName('');
      setTarget('');
      setTargetDate('');
      setSaved('');
      setFormOpen(false);
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setCreating(false);
    }
  };

  const handleContribute = async (id, amount) => {
    const data = await contributeToGoal(id, amount);
    setOverview(data);
  };

  const handleWithdraw = async (id, amount) => {
    const data = await withdrawFromGoal(id, amount);
    setOverview(data);
  };

  const handleConfirmDelete = async () => {
    if (!deletingGoal) return;
    try {
      const data = await deleteGoal(deletingGoal.id);
      setOverview(data);
      setDeletingGoal(null);
      setDeleteError(null);
    } catch (err) {
      setDeleteError(errorText(err));
    }
  };

  const goals = overview?.goals ?? [];
  const orderedGoals = [...goals].sort(
    (a, b) => (a.status === 'ACHIEVED') - (b.status === 'ACHIEVED')
  );
  const monthsUsed = overview?.monthsUsed ?? [];
  const breakdown = overview?.monthlyBreakdown ?? [];
  const topCategories = overview?.topSpendingCategories ?? [];
  const typical = Number(overview?.typicalMonthlySavings ?? 0);
  const averageNet = breakdown.length > 0
    ? breakdown.reduce((sum, m) => sum + Number(m.net), 0) / breakdown.length
    : 0;
  const activeGoalCount = goals.filter((g) => g.status === 'ON_TRACK' || g.status === 'BEHIND').length;
  const combinedShortfall = Number(overview?.combinedShortfallPerMonth ?? 0);
  const isDeficit = typical < 0;

  return (
    <div className="space-y-4">
      {/* Header with command buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text flex items-center gap-2">
          <Flag size={18} className="text-primary" /> Savings Goals
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSplitOpen(true)}
            className="flex items-center gap-1.5 text-sm bg-primary/10 text-primary hover:bg-primary/20 px-3.5 py-1.5 rounded-lg transition font-semibold"
          >
            <Sparkles size={16} /> Suggest Split
          </button>
          <button
            onClick={() => { setFormOpen(!formOpen); setFormError(null); }}
            className="flex items-center gap-1 text-sm bg-primary text-white px-3.5 py-1.5 rounded-lg hover:opacity-90 transition font-semibold"
          >
            <Plus size={16} /> {formOpen ? 'Cancel' : 'Add Goal'}
          </button>
        </div>
      </div>

      {/* Summary Bar with Info Trigger */}
      {overview && monthsUsed.length > 0 && (
        <div className="bg-bg border border-gray-200/60 dark:border-gray-700/60 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isDeficit ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>
              {isDeficit ? <AlertCircle size={18} /> : <Wallet size={18} />}
            </div>
            <div>
              <p className="text-xs text-gray-400">
                {isDeficit ? 'Monthly Overspending' : 'Monthly Savings Baseline'}
              </p>
              <p className={`text-sm font-semibold ${isDeficit ? 'text-danger' : 'text-primary'}`}>
                {formatINR(typical)} <span className="text-xs font-normal text-gray-400">/mo</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeGoalCount >= 2 && combinedShortfall > 0 && (
              <span className="hidden sm:inline-block text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                Shortfall: {formatINR(combinedShortfall)}/mo
              </span>
            )}

            <button
              onClick={() => setInfoOpen(true)}
              aria-label="View baseline calculations and details"
              className="p-2 rounded-xl bg-card border border-gray-200 dark:border-gray-700 text-text hover:text-primary transition shrink-0 flex items-center gap-1 text-xs font-medium"
              title="Calculation details & areas to trim"
            >
              <Info size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {infoOpen && (
        <div
          onClick={() => setInfoOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-gray-200 dark:border-gray-700 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-text flex items-center gap-2">
                <Info size={18} className="text-primary" /> Savings Baseline Details
              </h3>
            </div>

            <div className="space-y-3 text-xs text-text">
              <div>
                <p className="font-semibold text-sm mb-1">
                  Baseline:{' '}
                  <span className={typical >= 0 ? 'text-primary' : 'text-danger'}>
                    {formatINR(typical)}/mo
                  </span>
                </p>
                <p className="text-gray-400 leading-relaxed">
                  Calculated by taking income minus expenses for each month and using the middle (median) month. This prevents one-off credits or unusual spikes from distorting your long-term plan.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                {breakdown.map((m) => {
                  const used = breakdown.length % 2 === 1 && Math.abs(Number(m.net) - typical) < 0.005;
                  return (
                    <div
                      key={m.month}
                      className={`rounded-xl p-2.5 border ${
                        used
                          ? 'bg-primary/5 border-primary/50'
                          : 'bg-bg border-gray-200/60 dark:border-gray-700/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[11px] text-gray-400">{formatMonthLabel(m.month)}</p>
                        {used && <span className="text-[10px] font-semibold text-primary">baseline</span>}
                      </div>
                      <p className={`text-xs font-semibold mt-0.5 ${Number(m.net) >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatINR(m.net)}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        in {formatINR(m.income)} · out {formatINR(m.expenses)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <p className="text-gray-400">
                Your average monthly net across all statements is {formatINR(averageNet)}, but goal timelines rely on your middle baseline to stay realistic.
              </p>

              {activeGoalCount >= 2 && (
                <p className="text-gray-400">
                  Your goals require <span className="font-semibold text-text">{formatINR(overview.totalRequiredPerMonth)}</span> monthly.
                  {combinedShortfall > 0
                    ? ` This exceeds your baseline savings by ${formatINR(combinedShortfall)}. Active goals allocate savings to the nearest deadline first.`
                    : ' Your current baseline covers all active targets.'}
                </p>
              )}

              {topCategories.length > 0 && (
                <div className="bg-bg p-3 rounded-xl border border-gray-200/60 dark:border-gray-700/60 space-y-1">
                  <p className="font-semibold text-text">Recommended Places to Trim:</p>
                  <p className="text-gray-400">
                    {topCategories.map((c) => `${c.category} (${formatINR(c.monthlyAverage)}/mo)`).join(', ')}.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInfoOpen(false)}
                className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggest Split Modal (On Command) */}
      {splitOpen && (
        <div
          onClick={() => setSplitOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-gray-200 dark:border-gray-700 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-semibold text-text flex items-center gap-2">
                <Sparkles size={18} className="text-primary" /> AI Leftover Split Suggestion
              </h3>
              <button
                onClick={() => setSplitOpen(false)}
                className="text-gray-400 hover:text-text text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <LeftoverSplit refreshKey={refreshKey} />

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSplitOpen(false)}
                className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New goal form */}
      {formOpen && (
        <form
          onSubmit={handleCreate}
          className="bg-bg border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Goal name</label>
              <input
                type="text"
                placeholder="e.g. New phone"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Target amount (₹)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 20000"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Target date</label>
              <input
                type="date"
                min={tomorrowISO()}
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className={`${INPUT_CLASS} [color-scheme:light] dark:[color-scheme:dark]`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Already saved (₹, optional)</label>
              <input
                type="number"
                min="0"
                max={target || undefined}
                placeholder="0"
                value={saved}
                onChange={(e) => setSaved(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className={`text-xs font-semibold ${formError ? 'text-danger' : 'text-transparent'}`}>
              {formError || '.'}
            </p>
            <button
              type="submit"
              disabled={creating}
              className="bg-primary text-white px-5 py-2 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              <span>{creating ? 'Saving...' : 'Create goal'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Goals List */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          <Loader2 size={16} className="animate-spin" />
          <span>Loading your goals...</span>
        </div>
      ) : loadError ? (
        <p className="text-sm text-danger">Could not load goals: {loadError}</p>
      ) : goals.length === 0 ? (
        <p className="text-sm text-gray-400">
          No goals yet. Set one to see what you need to save each month.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {orderedGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onContribute={handleContribute}
              onWithdraw={handleWithdraw}
              onDelete={(g) => { setDeletingGoal(g); setDeleteError(null); }}
            />
          ))}
        </div>
      )}

      {deletingGoal && (
        <ConfirmDialog
          title="Delete Goal"
          message={`Are you sure you want to delete the goal "${deletingGoal.name}"? Its saved progress will be lost.`}
          error={deleteError}
          onConfirm={handleConfirmDelete}
          onCancel={() => { setDeletingGoal(null); setDeleteError(null); }}
        />
      )}
    </div>
  );
}

export default SavingsGoals;