import { useState, useEffect } from 'react';
import { getChargeInsights } from '../api/charges';
import { Repeat, AlertTriangle, Calendar, ArrowUpRight } from 'lucide-react';

function formatINR(amount) {
  const n = Number(amount || 0);
  return `${n < 0 ? '-' : ''}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function ChargeInsights({ refreshKey, selectedMonth = 'All', availableMonths = [] }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(selectedMonth);

  useEffect(() => {
    setCurrentMonth(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getChargeInsights(currentMonth === 'All' ? null : currentMonth)
      .then((data) => setInsights(data))
      .catch((err) => setError(err.message || 'Failed to load charge insights.'))
      .finally(() => setLoading(false));
  }, [refreshKey, currentMonth]);

  const recurringList = insights?.recurringCharges || [];
  const unusualList = insights?.unusualCharges || [];

  return (
    <div className="space-y-4">
      {/* Header & Month Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text flex items-center gap-2">
            <Repeat size={18} className="text-primary" /> Recurring & Unusual Activity
          </h3>
          <p className="text-xs text-gray-400">
            Automated detection of recurring subscriptions and spending anomalies {currentMonth === 'All' ? 'across all data' : `for ${currentMonth}`}.
          </p>
        </div>

        {availableMonths.length > 0 && (
          <div className="inline-flex items-center gap-2 bg-bg border border-gray-200/60 dark:border-gray-700/60 rounded-xl px-3 py-1.5">
            <Calendar size={14} className="text-primary" />
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(e.target.value)}
              className="bg-transparent text-xs font-semibold text-text focus:outline-none cursor-pointer"
            >
              <option value="All" className="bg-card text-text">All Months</option>
              {availableMonths.map((m) => (
                <option key={m} value={m} className="bg-card text-text">{m}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-gray-400">Analyzing transaction patterns...</div>
      ) : error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Recurring Bills Column */}
          <div className="bg-bg border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Repeat size={15} />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-text">Recurring Bills</h4>
              </div>
              <span className="text-xs font-semibold text-primary">
                {formatINR(insights?.totalRecurringMonthly)}/mo total
              </span>
            </div>

            {recurringList.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">
                No consistent recurring bills found for this period.
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {recurringList.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-card p-3 rounded-xl border border-gray-200/40 dark:border-gray-700/40 text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-text truncate">{item.merchantName}</p>
                      <p className="text-gray-400 text-[11px] mt-0.5">
                        {item.category} · Last {formatDate(item.lastDate)} ({item.occurrenceCount}x)
                      </p>
                    </div>
                    <p className="font-bold text-text whitespace-nowrap">{formatINR(item.typicalAmount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unusual Spikes Column */}
          <div className="bg-bg border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                  <AlertTriangle size={15} />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-text">Unusual Charges</h4>
              </div>
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                {unusualList.length} flagged
              </span>
            </div>

            {unusualList.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">
                No abnormal spending spikes detected.
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {unusualList.map((item) => (
                  <div key={item.transactionId} className="flex items-center justify-between bg-card p-3 rounded-xl border border-gray-200/40 dark:border-gray-700/40 text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-text truncate">{item.merchant || item.description}</p>
                      <p className="text-gray-400 text-[11px] mt-0.5">
                        {item.category} · {formatDate(item.date)} (typ. {formatINR(item.typicalCategoryMedian)})
                      </p>
                    </div>
                    <p className="font-bold text-danger whitespace-nowrap">{formatINR(item.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}