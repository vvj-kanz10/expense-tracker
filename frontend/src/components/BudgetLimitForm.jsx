import { useState } from 'react';
import { setBudgetLimit } from '../api/budgetLimits';
import { PiggyBank } from 'lucide-react';

const CATEGORIES = [
  'Food & Dining', 'Groceries', 'Transport', 'Shopping',
  'Bills & Utilities', 'Entertainment', 'Health & Fitness',
  'Rent/Housing', 'Other/People'
];

function BudgetLimitForm({ onLimitSet }) {
  const [category, setCategory] = useState('OVERALL');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

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
      setMessage('Limit saved!');
      setAmount('');
      if (onLimitSet) onLimitSet();
    } catch (err) {
      setMessage(`Failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-bg rounded-lg p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
      <div className="flex-1">
        <label className="flex items-center gap-1 text-xs font-medium text-gray-400 mb-1">
          <PiggyBank size={14} /> Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 bg-card text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary transition"
        >
          <option value="OVERALL">Overall (all spending)</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-400 mb-1">Limit amount</label>
        <input
          type="number"
          placeholder="e.g. 5000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 bg-card text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary transition"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="bg-primary text-white px-5 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50 whitespace-nowrap"
      >
        {saving ? 'Saving...' : 'Set Limit'}
      </button>

      {message && (
        <p className={`text-sm ${message.startsWith('Failed') || message.startsWith('Enter') ? 'text-danger' : 'text-success'}`}>
          {message}
        </p>
      )}
    </form>
  );
}

export default BudgetLimitForm;