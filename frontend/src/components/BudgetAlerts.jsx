import { useEffect, useState } from 'react';
import { getBudgetLimits } from '../api/budgetLimits';
import { AlertTriangle, Calendar } from 'lucide-react';

function getAvailableMonthKeys(transactions) {
  const keys = new Set();
  transactions.forEach((t) => {
    const date = new Date(t.transactionDate);
    keys.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  });
  return Array.from(keys).sort().reverse();
}

function getSpendingForMonth(transactions, monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const spending = { overall: 0, byCategory: {} };

  transactions.forEach((t) => {
    if (t.type !== 'EXPENSE') return;
    const date = new Date(t.transactionDate);
    if (date.getFullYear() !== year || date.getMonth() + 1 !== month) return;

    const amount = Number(t.amount);
    spending.overall += amount;
    spending.byCategory[t.category] = (spending.byCategory[t.category] || 0) + amount;
  });

  return spending;
}

function BudgetAlerts({ transactions, refreshKey }) {
  const [limits, setLimits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const availableMonths = getAvailableMonthKeys(transactions);

  useEffect(() => {
    getBudgetLimits()
      .then(setLimits)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedMonth && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  if (loading) return <p className="text-gray-400 text-sm">Loading budget status...</p>;
  if (limits.length === 0) return <p className="text-gray-400 text-sm">No budget limits set yet.</p>;
  if (!selectedMonth) return <p className="text-gray-400 text-sm">No transactions to check against limits.</p>;

  const spending = getSpendingForMonth(transactions, selectedMonth);

  return (
    <div className="mt-4 space-y-4">
      <div className="inline-flex items-center gap-2 bg-bg border border-gray-300 dark:border-gray-600 rounded-full px-3 py-1.5">
        <Calendar size={16} className="text-secondary" />
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-transparent text-sm font-medium text-text focus:outline-none"
        >
          {availableMonths.map((key) => {
            const [year, month] = key.split('-');
            const label = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
            return <option key={key} value={key} className="bg-card text-text">{label}</option>;
          })}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {limits.map((limit) => {
          const spent = limit.category ? (spending.byCategory[limit.category] || 0) : spending.overall;
          const percent = Math.min((spent / limit.limitAmount) * 100, 100);
          const rawPercent = (spent / limit.limitAmount) * 100;
          const label = limit.category || 'Overall';

          let status = 'OK';
          if (rawPercent >= 100) status = 'OVER';
          else if (rawPercent >= 80) status = 'WARNING';

          const barColor = status === 'OVER' ? 'bg-danger' : status === 'WARNING' ? 'bg-warning' : 'bg-primary';

          return (
            <div key={limit.id} className="bg-bg rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-text text-sm">{label}</span>
                {status === 'WARNING' && (
                  <span className="flex items-center gap-1 text-xs font-medium text-warning">
                    <AlertTriangle size={14} /> Approaching
                  </span>
                )}
                {status === 'OVER' && (
                  <span className="flex items-center gap-1 text-xs font-medium text-danger">
                    <AlertTriangle size={14} /> Over budget
                  </span>
                )}
              </div>

              <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mb-2">
                <div className={`h-full ${barColor} transition-all`} style={{ width: `${percent}%` }} />
              </div>

              <p className="text-xs text-gray-400">
                ₹{spent.toFixed(0)} of ₹{limit.limitAmount} ({rawPercent.toFixed(0)}%)
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BudgetAlerts;