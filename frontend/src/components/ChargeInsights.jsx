import { useState, useEffect } from 'react';
import { getChargeInsights } from '../api/charges';
import { Repeat, AlertTriangle, CheckCircle2 } from 'lucide-react';

function formatINR(amount) {
  const n = Number(amount || 0);
  return `${n < 0 ? '-' : ''}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Treat empty / "Unknown" / "Uncategorized" as "no real name"
function isMissingName(value) {
  const v = (value || '').trim().toLowerCase();
  return v === '' || v === 'unknown' || v === 'uncategorized';
}

// Pick the best label to show: merchant if it's real, else the description, else a plain fallback
function displayName(merchant, description) {
  if (!isMissingName(merchant)) return merchant.trim();
  if (!isMissingName(description)) return description.trim();
  return 'Unnamed payment';
}

// "5.5× usual" style text; empty if we can't compute it sensibly
function usualMultiple(amount, typical) {
  const a = Math.abs(Number(amount || 0));
  const t = Math.abs(Number(typical || 0));
  if (!t || !a) return '';
  const ratio = a / t;
  if (ratio < 1.5) return '';
  return `${ratio.toFixed(1)}× usual`;
}

// Round avatar showing the first letter of a name
function Avatar({ name, tone }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${tone}`}>
      {letter}
    </div>
  );
}

function EmptyState({ icon, title, hint, tone }) {
  return (
    <div className="py-8 flex flex-col items-center text-center gap-2">
      <div className={`p-3 rounded-full ${tone}`}>{icon}</div>
      <p className="text-sm font-semibold text-text">{title}</p>
      <p className="text-xs text-gray-400 max-w-[220px]">{hint}</p>
    </div>
  );
}

export default function ChargeInsights({ refreshKey }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    // Always pass null to evaluate recurring payments and insights across overall lifetime data
    getChargeInsights(null)
      .then((data) => setInsights(data))
      .catch((err) => setError(err.message || 'Failed to load charge insights.'))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  // Translate the backend's field names into the ones this card uses
  const recurringList = (insights?.recurring || insights?.recurringCharges || []).map((r) => ({
    merchantName: displayName(r.name ?? r.merchantName, r.description),
    category: r.category,
    typicalAmount: r.typicalAmount,
    occurrenceCount: r.timesSeen ?? r.occurrenceCount,
    lastDate: r.lastDate,
  }));
  const unusualList = (insights?.unusual || insights?.unusualCharges || []).map((u) => ({
    transactionId: u.transactionId,
    name: displayName(u.merchant, u.description),
    category: u.category,
    date: u.date,
    amount: u.amount,
    typicalCategoryMedian: u.typicalAmount ?? u.typicalCategoryMedian,
  }));
  const recurringTotal = Number(insights?.recurringMonthlyTotal ?? insights?.totalRecurringMonthly ?? 0);

  const cardClass =
    'bg-bg border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md';
  const rowClass =
    'flex items-center gap-3 bg-card p-3.5 rounded-xl border border-gray-200/40 dark:border-gray-700/40 transition-colors duration-200 hover:border-primary/40';

  return (
    <div className="space-y-4">
      {/* Header & Description */}
      <div>
        <h3 className="text-base font-semibold text-text flex items-center gap-2">
          <Repeat size={18} className="text-primary" /> Recurring & Unusual Activity
        </h3>
        <p className="text-xs text-gray-400 mt-0.5 sm:ml-7">
          Automatically spots repeating bills and charges that stand out, across all your data.
        </p>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-400 animate-pulse">Analyzing transaction patterns...</div>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Recurring Bills */}
          <div className={cardClass}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Repeat size={16} />
                </div>
                <h4 className="text-sm font-semibold text-text">Recurring bills</h4>
              </div>
              {recurringTotal > 0 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary whitespace-nowrap">
                  {formatINR(recurringTotal)} / month
                </span>
              )}
            </div>

            {recurringList.length === 0 ? (
              <EmptyState
                icon={<Repeat size={20} />}
                tone="bg-primary/10 text-primary"
                title="No recurring bills yet"
                hint="Payments that repeat every month will show up here."
              />
            ) : (
              <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                {recurringList.map((item, idx) => (
                  <div key={idx} className={rowClass}>
                    <Avatar name={item.merchantName} tone="bg-primary/10 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text truncate">{item.merchantName}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {item.category} · {item.occurrenceCount}x · last {formatDate(item.lastDate)}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-text whitespace-nowrap">{formatINR(item.typicalAmount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unusual Charges */}
          <div className={cardClass}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                  <AlertTriangle size={16} />
                </div>
                <h4 className="text-sm font-semibold text-text">Unusual charges</h4>
              </div>
              {unusualList.length > 0 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 whitespace-nowrap">
                  {unusualList.length} flagged
                </span>
              )}
            </div>

            {unusualList.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 size={20} />}
                tone="bg-emerald-500/10 text-emerald-500"
                title="All clear"
                hint="No charges that look unusually large for their category."
              />
            ) : (
              <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                {unusualList.map((item) => {
                  const multiple = usualMultiple(item.amount, item.typicalCategoryMedian);
                  return (
                    <div key={item.transactionId} className={rowClass}>
                      <Avatar name={item.name} tone="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text truncate">{item.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {item.category} · {formatDate(item.date)}
                        </p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p className="text-sm font-bold text-danger">{formatINR(item.amount)}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          usually {formatINR(item.typicalCategoryMedian)}
                          {multiple && <span className="text-amber-600 dark:text-amber-400 font-medium"> · {multiple}</span>}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}