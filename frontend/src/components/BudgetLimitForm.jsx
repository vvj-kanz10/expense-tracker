import { useState, useEffect } from 'react';
import { getBudgetLimits, setBudgetLimit, deleteBudgetLimit, getBudgetSuggestions } from '../api/budgetLimits';
import { PiggyBank, Trash2, Plus, Loader2, Wand2, Check } from 'lucide-react';

const CATEGORIES = [
  'Food & Dining', 'Groceries', 'Transport', 'Shopping',
  'Bills & Utilities', 'Entertainment', 'Health & Fitness',
  'Rent/Housing', 'Other/People'
];

function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// "2026-07" -> "Jul 2026"
function formatMonthLabel(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function BudgetLimitForm({ onLimitSet }) {
  const [category, setCategory] = useState('OVERALL');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const [limits, setLimits] = useState([]);
  const [loadingLimits, setLoadingLimits] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  // Suggested budget panel
  const [suggestions, setSuggestions] = useState(null); // null = panel closed
  const [monthsUsed, setMonthsUsed] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [applying, setApplying] = useState(false);

  const fetchLimits = async () => {
    try {
      setLoadingLimits(true);
      const data = await getBudgetLimits();
      setLimits(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load budget limits', err);
    } finally {
      setLoadingLimits(false);
    }
  };

  useEffect(() => {
    fetchLimits();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!amount || Number(amount) <= 0) {
      setMessage('Enter a valid amount.');
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const categoryValue = category === 'OVERALL' ? null : category;
      await setBudgetLimit(categoryValue, Number(amount));
      setMessage('Limit saved successfully!');
      setAmount('');
      fetchLimits();
      if (onLimitSet) onLimitSet();
    } catch (err) {
      setMessage(`Failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    setMessage(null);
    try {
      await deleteBudgetLimit(id);
      setMessage('Limit removed.');
      fetchLimits();
      if (onLimitSet) onLimitSet();
    } catch (err) {
      setMessage(`Failed to delete: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  /* ----- suggested budget ----- */

  const handleSuggest = async () => {
    setMessage(null);
    setLoadingSuggestions(true);
    try {
      const data = await getBudgetSuggestions();
      const rows = (data.suggestions || []).map((s) => ({
        key: s.category ?? 'OVERALL',
        category: s.category,
        monthlyAverage: s.monthlyAverage,
        currentLimit: s.currentLimit,
        value: String(s.suggestedLimit),
        // Don't overwrite a limit the user already set unless they tick it themselves
        include: s.currentLimit == null,
      }));

      if (rows.length === 0) {
        setSuggestions(null);
        setMessage('Failed: not enough spending data yet to suggest a budget.');
      } else {
        setSuggestions(rows);
        setMonthsUsed(data.monthsUsed || []);
      }
    } catch (err) {
      setMessage(`Failed: ${err.message}`);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const updateRow = (key, changes) => {
    setSuggestions((rows) => rows.map((r) => (r.key === key ? { ...r, ...changes } : r)));
  };

  const handleApply = async () => {
    const chosen = suggestions.filter((r) => r.include);

    if (chosen.length === 0) {
      setMessage('Failed: tick at least one limit to apply.');
      return;
    }
    if (chosen.some((r) => !r.value || Number(r.value) <= 0)) {
      setMessage('Enter a valid amount for every ticked limit.');
      return;
    }

    setApplying(true);
    setMessage(null);

    try {
      for (const row of chosen) {
        await setBudgetLimit(row.category, Number(row.value));
      }
      setMessage(`Applied ${chosen.length} budget limits.`);
      setSuggestions(null);
    } catch (err) {
      setMessage(`Failed: ${err.message}`);
    } finally {
      setApplying(false);
      fetchLimits();
      if (onLimitSet) onLimitSet();
    }
  };

  // Only offer "Suggest budget" to users who have no limits yet
  const showSuggestBanner = !loadingLimits && limits.length === 0 && suggestions === null;

  return (
    <div className="bg-bg rounded-xl p-5 space-y-5 border border-gray-200/60 dark:border-gray-700/60 shadow-sm transition-all">

      {/* Suggest budget banner (hidden once the user has any limits) */}
      {showSuggestBanner && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-text">Not sure what to set?</p>
            <p className="text-xs text-gray-400">
              We work out a limit for each category from your own recent spending. You can edit before saving.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSuggest}
            disabled={loadingSuggestions || applying}
            className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-1.5"
          >
            {loadingSuggestions ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            <span>{loadingSuggestions ? 'Working it out...' : 'Suggest budget'}</span>
          </button>
        </div>
      )}

      {/* Suggestions panel */}
      {suggestions && (
        <div className="bg-card border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text">Suggested monthly limits</h3>
              {monthsUsed.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Based on {monthsUsed.map(formatMonthLabel).join(', ')}. Each limit is the average plus 10%, rounded up.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSuggestions(null)}
              className="text-xs text-gray-400 hover:text-text transition"
            >
              Close
            </button>
          </div>

          <div className="space-y-2">
            {suggestions.map((row) => (
              <div
                key={row.key}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-bg border border-gray-200/60 dark:border-gray-700/60 rounded-xl px-3.5 py-2.5"
              >
                <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={row.include}
                    onChange={(e) => updateRow(row.key, { include: e.target.checked })}
                    className="h-4 w-4 accent-primary cursor-pointer flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text truncate">
                      {row.category ? row.category : 'Overall (all spending)'}
                    </p>
                    <p className="text-xs text-gray-400">
                      Average {formatCurrency(row.monthlyAverage)}
                      {row.currentLimit != null && (
                        <span className="text-warning"> · current limit {formatCurrency(row.currentLimit)}</span>
                      )}
                    </p>
                  </div>
                </label>

                <div className="flex items-center gap-1.5 sm:w-36">
                  <span className="text-sm text-gray-400">₹</span>
                  <input
                    type="number"
                    value={row.value}
                    onChange={(e) => updateRow(row.key, { value: e.target.value, include: true })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-card text-text rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleApply}
              disabled={applying}
              className="bg-primary text-white px-5 py-2 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              {applying ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              <span>{applying ? 'Saving...' : 'Apply ticked limits'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Manual form */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="flex items-center gap-1 text-xs font-medium text-gray-400 mb-1.5">
            <PiggyBank size={14} className="text-primary" /> Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-card text-text rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition shadow-sm"
          >
            <option value="OVERALL" className="bg-card text-text">Overall (all spending)</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat} className="bg-card text-text">{cat}</option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Limit amount</label>
          <input
            type="number"
            placeholder="e.g. 5000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-card text-text rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition shadow-sm"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-1.5 h-[42px]"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          <span>{saving ? 'Saving...' : 'Set Limit'}</span>
        </button>
      </form>

      {/* Message feedback */}
      {message && (
        <p className={`text-xs font-semibold animate-fadeIn ${message.includes('Failed') || message.includes('Enter') ? 'text-danger' : 'text-success'}`}>
          {message}
        </p>
      )}

      {/* Active Limits Grid/Badges */}
      <div className="space-y-2.5 pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Limits Configured</h3>

        {loadingLimits ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
            <Loader2 size={14} className="animate-spin" />
            <span>Loading active limits...</span>
          </div>
        ) : limits.length === 0 ? (
          <p className="text-xs text-gray-400 py-1">No custom budget limits set yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {limits.map((limit) => (
              <div
                key={limit.id}
                className="group flex items-center justify-between bg-card border border-gray-200/80 dark:border-gray-700/80 px-3.5 py-2.5 rounded-xl shadow-xs hover:border-primary/50 transition-all"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-medium text-gray-400 truncate">
                    {limit.category ? limit.category : 'Overall Spending'}
                  </p>
                  <p className="text-sm font-bold text-text mt-0.5">
                    {formatCurrency(limit.limitAmount)}
                  </p>
                </div>

                <button
                  onClick={() => handleDelete(limit.id)}
                  disabled={deletingId === limit.id}
                  aria-label="Delete budget limit"
                  title="Remove limit"
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-danger transition-all disabled:opacity-50 flex-shrink-0"
                >
                  {deletingId === limit.id ? (
                    <Loader2 size={15} className="animate-spin text-danger group-hover:text-white" />
                  ) : (
                    <Trash2 size={15} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BudgetLimitForm;