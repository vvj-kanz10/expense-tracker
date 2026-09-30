import { useState } from 'react';
import { X } from 'lucide-react';

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
  'Other/People',
];

function EditTransactionModal({ transaction, onClose, onSave }) {
  const [category, setCategory] = useState(transaction.category || 'Other/People');
  const [merchant, setMerchant] = useState(transaction.merchant || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(transaction.id, { category, merchant });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

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