import { useState, useEffect } from 'react';
import { X, Loader2, Plus } from 'lucide-react';

const SPLIT_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transport',
  'Shopping',
  'Bills & Utilities',
  'Entertainment',
  'Health & Fitness',
  'Rent/Housing',
  'Other/People',
];

function formatCurrency(amount) {
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const inputClass =
  'border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 bg-white dark:bg-[#1a2333] text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition shadow-sm disabled:opacity-50';

let rowCounter = 0;
const newRow = (category = 'Food & Dining', amount = '') => ({ key: ++rowCounter, category, amount });

// withdrawal: the bank row being split
// existingSplits: parts already saved for it
// onSave(parts): saves the parts (rejects with an error on failure)
function SplitWithdrawalModal({ withdrawal, existingSplits, onSave, onClose }) {
  const [rows, setRows] = useState(() =>
    existingSplits.length > 0
      ? existingSplits.map((s) => newRow(s.category, String(s.amount)))
      : [newRow()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  // Work in paise (whole numbers) so decimals never cause off-by-a-paisa errors
  const toCents = (value) => Math.round((Number(value) || 0) * 100);
  const withdrawalCents = toCents(withdrawal.amount);
  const splitCents = rows.reduce((sum, r) => sum + toCents(r.amount), 0);
  const remainingCents = withdrawalCents - splitCents;
  const isOver = remainingCents < 0;

  const updateRow = (key, field, value) => {
    setError(null);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const removeRow = (key) => setRows((prev) => prev.filter((r) => r.key !== key));

  const addRow = () => {
    const unused = SPLIT_CATEGORIES.find((c) => !rows.some((r) => r.category === c));
    setRows((prev) => [...prev, newRow(unused || SPLIT_CATEGORIES[0])]);
  };

  // Puts whatever is still unsplit into this row
  const fillRest = (key) => {
    const row = rows.find((r) => r.key === key);
    const cents = remainingCents + toCents(row.amount);
    if (cents > 0) updateRow(key, 'amount', (cents / 100).toFixed(2));
  };

  const handleSave = async () => {
    setError(null);
    if (rows.some((r) => toCents(r.amount) <= 0)) {
      setError('Every part needs an amount greater than zero.');
      return;
    }
    if (isOver) {
      setError('The parts add up to more than the withdrawal.');
      return;
    }

    setSaving(true);
    try {
      await onSave(rows.map((r) => ({ category: r.category, amount: toCents(r.amount) / 100 })));
      onClose();
    } catch (err) {
      const data = err.response?.data;
      setError((typeof data === 'string' ? data : data?.message) || err.message || 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setError(null);
    setSaving(true);
    try {
      await onSave([]);
      onClose();
    } catch (err) {
      const data = err.response?.data;
      setError((typeof data === 'string' ? data : data?.message) || err.message || 'Could not clear. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-[#131c2e] rounded-2xl shadow-xl border border-gray-200/80 dark:border-gray-800/80">
        <div className="p-6 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Where did this cash go?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(withdrawal.amount)}</span>
                {' '}withdrawn on {withdrawal.transactionDate}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              aria-label="Close"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#1a2333] transition disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 py-2 overflow-y-auto space-y-2.5">
          {rows.map((row) => {
            const options = SPLIT_CATEGORIES.includes(row.category)
              ? SPLIT_CATEGORIES
              : [...SPLIT_CATEGORIES, row.category];
            return (
              <div key={row.key} className="flex items-center gap-2">
                <select
                  value={row.category}
                  onChange={(e) => updateRow(row.key, 'category', e.target.value)}
                  disabled={saving}
                  className={`${inputClass} flex-1 min-w-0`}
                >
                  {options.map((c) => (
                    <option key={c} value={c} className="bg-card text-text">{c}</option>
                  ))}
                </select>

                <div className="relative w-32 flex-shrink-0">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={row.amount}
                    onChange={(e) => updateRow(row.key, 'amount', e.target.value)}
                    placeholder="0.00"
                    disabled={saving}
                    className={`${inputClass} w-full`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => fillRest(row.key)}
                  disabled={saving || remainingCents + toCents(row.amount) <= 0}
                  title="Put the unsplit amount here"
                  className="text-xs font-semibold text-primary px-1.5 py-1 rounded-md hover:bg-primary/10 transition disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  Rest
                </button>

                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  disabled={saving || rows.length === 1}
                  aria-label="Remove part"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-danger hover:bg-gray-100 dark:hover:bg-[#1a2333] transition disabled:opacity-30"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addRow}
            disabled={saving}
            className="flex items-center gap-1 text-sm font-semibold text-primary hover:opacity-80 transition py-1 disabled:opacity-50"
          >
            <Plus size={16} /> Add another part
          </button>
        </div>

        <div className="p-6 pt-3 space-y-3">
          <div className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium ${
            isOver
              ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
              : 'bg-gray-50 text-gray-600 dark:bg-[#1a2333] dark:text-gray-300'
          }`}>
            <span>{isOver ? 'Over by' : 'Left as Withdrawal'}</span>
            <span className="font-bold">{formatCurrency(Math.abs(remainingCents) / 100)}</span>
          </div>

          {error && <p className="text-xs font-semibold text-danger">{error}</p>}

          <div className="flex items-center justify-between gap-2">
            <div>
              {existingSplits.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={saving}
                  className="px-3 py-2 rounded-xl text-sm font-medium text-danger hover:bg-rose-50 dark:hover:bg-rose-500/10 transition disabled:opacity-50"
                >
                  Clear split
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a2333] transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || isOver}
                className="flex items-center gap-1.5 bg-primary text-white px-5 py-2 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-md disabled:opacity-50"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'Saving...' : 'Save split'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SplitWithdrawalModal;