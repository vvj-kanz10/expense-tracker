import { useState } from 'react';
import { X } from 'lucide-react';
import { getSimilarTransactions, applyToSimilar } from '../api/transactions';

// Same fixed category list GeminiCategorizationService uses, so the
// dropdown never lets a user pick something the AI wouldn't also produce.
const CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transport',
  'Shopping',
  'Bills & Utilities',
  'Entertainment',
  'Health & Fitness',
  'Rent/Housing',
  'Income',
  'Withdrawal',
  'Other/People',
];

const PREVIEW_LIMIT = 5;

function EditTransactionModal({ transaction, onClose, onSave, onApplied }) {
  const [category, setCategory] = useState(transaction.category || 'Other/People');
  const [merchant, setMerchant] = useState(transaction.merchant || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // null = normal edit view, array = showing the "apply to similar?" popup
  const [similar, setSimilar] = useState(null);
  const [applying, setApplying] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(transaction.id, { category, merchant });

      // Only ask about similar rows if the user actually changed category or merchant
      const changed =
        category !== (transaction.category || 'Other/People') ||
        merchant !== (transaction.merchant || '');

      if (changed) {
        try {
          const list = await getSimilarTransactions(transaction.id);
          if (list.length > 0) {
            setSimilar(list);
            return; // stay open and show the popup
          }
        } catch {
          // The save already worked, so if this lookup fails just close normally
        }
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      await applyToSimilar(transaction.id);
      onApplied?.(); // lets the page reload its list
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update similar transactions.');
    } finally {
      setApplying(false);
    }
  };

  // ---------- Popup view: "apply to similar?" ----------
  if (similar) {
    const shown = similar.slice(0, PREVIEW_LIMIT);
    const extra = similar.length - shown.length;
    const label = merchant ? `${category} / ${merchant}` : category;

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
        <div className="bg-card rounded-xl shadow-lg w-full max-w-sm p-6">
          <h3 className="text-lg font-semibold text-text mb-2">Apply to similar?</h3>
          <p className="text-sm text-text mb-4">
            Apply <span className="font-semibold">{label}</span> to{' '}
            {similar.length} other similar transaction{similar.length > 1 ? 's' : ''}?
          </p>

          <ul className="mb-4 space-y-2">
            {shown.map((t) => (
              <li key={t.id} className="text-sm text-gray-400 flex justify-between gap-3">
                <span className="truncate">{t.description}</span>
                <span className="shrink-0">₹{t.amount}</span>
              </li>
            ))}
            {extra > 0 && (
              <li className="text-sm text-gray-400">+ {extra} more</li>
            )}
          </ul>

          <p className="text-xs text-gray-400 mb-4">
            Only category and merchant change. Amount and date stay the same.
          </p>

          {error && <p className="text-danger text-sm mb-3">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={applying}
              className="px-4 py-2 rounded-lg text-sm text-text hover:bg-bg transition"
            >
              No
            </button>
            <button
              onClick={handleApply}
              disabled={applying}
              className="px-4 py-2 rounded-lg text-sm bg-primary text-white hover:opacity-90 transition disabled:opacity-50"
            >
              {applying ? 'Applying...' : 'Yes, apply'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Normal edit view ----------
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-card rounded-xl shadow-lg w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">Edit Transaction</h3>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-text transition">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-4">{transaction.description}</p>

        <label className="block text-sm text-text mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full mb-4 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-card text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <label className="block text-sm text-text mb-1">Merchant</label>
        <input
          type="text"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          className="w-full mb-4 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-card text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
        />

        {error && <p className="text-danger text-sm mb-3">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-text hover:bg-bg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm bg-primary text-white hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditTransactionModal;