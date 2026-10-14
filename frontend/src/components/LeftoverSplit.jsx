import { useEffect, useState } from 'react';
import { Sparkles, Calculator } from 'lucide-react';
import { getLeftoverSplit } from '../api/leftover';

function formatCurrency(amount) {
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function monthLabel(key) {
  const [year, month] = key.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });
}

export default function LeftoverSplit({ refreshKey }) {
  const [month, setMonth] = useState(null); // null = latest month
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getLeftoverSplit(month)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the leftover split.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, refreshKey]);

  const selectedMonth = month || data?.month;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text">Leftover split</h3>
          <p className="text-xs text-gray-400">
            What was left after spending, and a suggested way to put it towards your goals.
          </p>
        </div>

        {data?.availableMonths?.length > 0 && (
          <select
            value={selectedMonth || ''}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-full px-3 py-1.5 text-sm bg-card text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
          >
            {data.availableMonths.map((m) => (
              <option key={m} value={m} className="bg-card text-text">
                {monthLabel(m)}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && !data && <p className="text-sm text-gray-400">Working out your split...</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {data && (
        <div className={`space-y-4 transition-opacity ${loading ? 'opacity-50' : ''}`}>
          {data.month && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-bg rounded-xl px-4 py-3 border border-gray-200/60 dark:border-gray-700/60">
                <p className="text-xs text-gray-400 mb-1">Income</p>
                <p className="text-base font-bold text-text">{formatCurrency(data.income)}</p>
              </div>
              <div className="bg-bg rounded-xl px-4 py-3 border border-gray-200/60 dark:border-gray-700/60">
                <p className="text-xs text-gray-400 mb-1">Spent</p>
                <p className="text-base font-bold text-text">{formatCurrency(data.expenses)}</p>
              </div>
              <div className="bg-bg rounded-xl px-4 py-3 border border-primary/40">
                <p className="text-xs text-gray-400 mb-1">Left over</p>
                <p className={`text-base font-bold ${Number(data.leftover) < 0 ? 'text-danger' : 'text-primary'}`}>
                  {formatCurrency(data.leftover)}
                </p>
              </div>
            </div>
          )}

          {data.message && <p className="text-sm text-gray-400">{data.message}</p>}

          {data.allocations?.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                {data.source === 'AI' ? (
                  <>
                    <Sparkles size={14} className="text-primary" /> Suggested by AI
                  </>
                ) : (
                  <>
                    <Calculator size={14} /> Suggested by simple rules (AI was unavailable)
                  </>
                )}
              </div>

              <ul className="space-y-2">
                {data.allocations.map((a) => (
                  <li
                    key={a.goalId}
                    className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text">{a.goalName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{a.reason}</p>
                    </div>
                    <p className="text-sm font-bold text-primary whitespace-nowrap">
                      {formatCurrency(a.amount)}
                    </p>
                  </li>
                ))}
              </ul>

              <p className="text-sm text-text">
                <span className="font-semibold text-primary">{formatCurrency(data.freeToSpend)}</span> stays free to spend.
              </p>
              <p className="text-xs text-gray-400">
                This is only a suggestion. Use "Add money" on a goal to actually set the money aside.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}