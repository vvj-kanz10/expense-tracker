import { useState, useEffect } from 'react';
import { X, Loader2, Plus } from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transport',
  'Shopping',
  'Bills & Utilities',
  'Entertainment',
  'Health & Fitness',
  'Rent/Housing',
  'Withdrawal',
  'Other/People',
];

// Today's date as yyyy-MM-dd in the user's own time zone
function todayLocal() {
  return new Date().toLocaleDateString('en-CA');
}

const inputClass =
  'w-full border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 bg-white dark:bg-[#1a2333] text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition shadow-sm disabled:opacity-50';

function AddTransactionModal({ onSave, onClose }) {
  const [type, setType] = useState('EXPENSE');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food & Dining');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Close with the Escape key (unless a save is in progress)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!date) {
      setError('Pick a date.');
      return;
    }
    if (date > todayLocal()) {
      setError('The date cannot be in the future.');
      return;
    }

    const payload = {
      transactionDate: date,
      type,
      amount: Math.round(value * 100) / 100,
      description: description.trim() || merchant.trim() || 'Manual entry',
      merchant: merchant.trim() || 'Unknown',
      category: type === 'INCOME' ? 'Income' : category,
    };

    setSaving(true);
    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      const data = err.response?.data;
      const serverMessage = typeof data === 'string' ? data : data?.message;
      setError(serverMessage || err.message || 'Could not add the transaction. Please try again.');
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
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white dark:bg-[#131c2e] rounded-2xl shadow-xl border border-gray-200/80 dark:border-gray-800/80 p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add transaction</h2>
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

        {/* Expense / Income switch */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-100 dark:bg-[#1a2333]">
          {[
            { value: 'EXPENSE', label: 'Expense' },
            { value: 'INCOME', label: 'Income' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={saving}
              onClick={() => setType(opt.value)}
              className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                type === opt.value
                  ? 'bg-white dark:bg-[#253045] text-primary shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Amount (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={saving}
              autoFocus
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date</label>
            <input
              type="date"
              value={date}
              max={todayLocal()}
              onChange={(e) => setDate(e.target.value)}
              disabled={saving}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Merchant <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="e.g. Local tea shop"
            disabled={saving}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Note <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Cash payment"
            disabled={saving}
            className={inputClass}
          />
        </div>

        {type === 'EXPENSE' && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={saving}
              className={inputClass}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-card text-text">{c}</option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-xs font-semibold text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a2333] transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 bg-primary text-white px-5 py-2 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-md disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {saving ? 'Adding...' : 'Add'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddTransactionModal;