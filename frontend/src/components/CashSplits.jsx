import { useState } from 'react';
import { Banknote, Scissors, Check, ChevronDown, Calendar, Tag } from 'lucide-react';

function formatCurrency(amount) {
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// withdrawals: bank rows in the Withdrawal category
// splits: every saved split (all withdrawals)
// onSplit(withdrawal): opens the split popup for that row
function CashSplits({ withdrawals, splits, onSplit }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('All');

  // Group withdrawals by month
  const groupedWithdrawals = {};
  withdrawals.forEach((tx) => {
    const date = new Date(tx.transactionDate);
    const monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!groupedWithdrawals[monthKey]) {
      groupedWithdrawals[monthKey] = {
        transactions: [],
        sortDate: new Date(date.getFullYear(), date.getMonth(), 1),
      };
    }
    groupedWithdrawals[monthKey].transactions.push(tx);
  });

  // Sort available months in descending order (latest month first)
  const availableMonths = Object.keys(groupedWithdrawals).sort(
    (a, b) => groupedWithdrawals[b].sortDate - groupedWithdrawals[a].sortDate
  );

  // Filter withdrawals based on selected month dropdown
  const filteredWithdrawals = selectedMonth === 'All' 
    ? withdrawals 
    : (groupedWithdrawals[selectedMonth]?.transactions || []);

  const rows = [...filteredWithdrawals]
    .sort((a, b) => (a.transactionDate < b.transactionDate ? 1 : -1))
    .map((w) => {
      const parts = splits.filter((s) => s.transactionId === w.id);
      const splitTotal = parts.reduce((sum, p) => sum + Number(p.amount), 0);
      const remaining = Math.round((Number(w.amount) - splitTotal) * 100) / 100;
      return { withdrawal: w, parts, splitTotal, remaining };
    });

  // Show 3 ATM withdrawals starting from the latest month/entries
  const visible = rows.slice(0, 3);
  const pending = rows.filter((r) => r.remaining > 0.005);
  const unsplitTotal = pending.reduce((sum, r) => sum + r.remaining, 0);

  return (
    <div className="space-y-4">
      {/* Clickable Header Accordion to toggle view */}
      <div 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between cursor-pointer p-4 rounded-xl bg-gray-50 dark:bg-[#182438] border border-gray-200/80 dark:border-gray-800 hover:border-primary/50 transition-all shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Banknote size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Cash withdrawals & Splits</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {withdrawals.length} total cash withdrawals recorded
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full hidden sm:inline-block">
            {expanded ? 'Hide Details' : 'Click to View List'}
          </span>
          <ChevronDown
            size={20}
            className={`text-gray-400 transition-transform duration-300 ${expanded ? 'rotate-180 text-primary' : ''}`}
          />
        </div>
      </div>

      {/* Expanded Content View */}
      {expanded && (
        <div className="space-y-4 animate-fadeIn pt-2">
          {/* Controls Bar: Month Dropdown Filter (Descending order) */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-[#131c2e] p-4 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-sm">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Calendar size={16} className="text-primary shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-[#1a2333] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary transition text-sm shadow-sm w-full sm:w-52 font-medium"
              >
                <option value="All">All Months ({withdrawals.length})</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m} ({groupedWithdrawals[m].transactions.length})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {withdrawals.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-3 text-center">
              No cash withdrawals found in your statements yet.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {pending.length > 0
                  ? `${formatCurrency(unsplitTotal)} of cash from ${pending.length} withdrawal${pending.length > 1 ? 's' : ''} in this view is not accounted for. Tell us where it went and your charts and budgets will reflect it. Your balance and totals stay the same.`
                  : 'All your cash withdrawals in this view are accounted for.'}
              </p>

              <div className="space-y-3">
                {visible.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-success font-medium py-2 bg-emerald-500/5 px-4 rounded-xl border border-emerald-500/10">
                    <Check size={16} /> Nothing left to display for this filter.
                  </div>
                )}

                {visible.map(({ withdrawal, parts, splitTotal, remaining }) => {
                  const percent = Math.min(100, (splitTotal / Number(withdrawal.amount)) * 100);
                  const isDone = remaining <= 0.005;

                  return (
                    <div
                      key={withdrawal.id}
                      className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#131c2e] p-4 hover:border-primary/40 transition shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            {formatCurrency(withdrawal.amount)}
                            <span className="text-xs font-normal text-gray-400 dark:text-gray-500 flex items-center gap-1">
                              <Calendar size={12} /> {withdrawal.transactionDate}
                            </span>
                            {isDone && (
                              <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                <Check size={12} /> Done
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5" title={withdrawal.description}>
                            {withdrawal.merchant || 'ATM / Cash'} · {withdrawal.description}
                          </p>
                        </div>
                        <button
                          onClick={() => onSplit(withdrawal)}
                          className="flex items-center gap-1.5 flex-shrink-0 text-xs font-semibold bg-primary text-white px-3 py-1.5 rounded-lg hover:opacity-90 active:scale-95 transition-all shadow-sm"
                        >
                          <Scissors size={14} /> {parts.length > 0 ? 'Edit split' : 'Split'}
                        </button>
                      </div>

                      <div className="mt-3 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                        {parts.map((p) => (
                          <span
                            key={p.id}
                            className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#1a2333] text-gray-600 dark:text-gray-300 font-medium flex items-center gap-1"
                          >
                            <Tag size={10} className="text-primary" />
                            {p.category} {formatCurrency(p.amount)}
                          </span>
                        ))}
                        <span className="text-gray-400 dark:text-gray-500 font-medium ml-1">
                          {remaining > 0.005 ? `${formatCurrency(remaining)} not split` : 'fully split'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default CashSplits;