import { useState, useEffect } from 'react';
import { getSavingsSuggestions, getCachedSuggestions } from '../api/insights';
import { Calendar, TrendingUp, TrendingDown, AlertTriangle, Sparkles, Loader2, Lightbulb, Eye, EyeOff, ArrowUpRight, ArrowDownRight } from 'lucide-react';

/* ---------- Helper Functions ---------- */

function formatRupees(amount) {
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function getMonthKey(dateText) {
  const date = new Date(dateText);
  if (isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getAvailableMonthKeys(transactions) {
  const keys = new Set();
  transactions.forEach((t) => {
    const key = getMonthKey(t.transactionDate);
    if (key) keys.add(key);
  });
  return Array.from(keys).sort().reverse();
}

function getTotalExpenseForMonth(transactions, monthKey) {
  let total = 0;
  transactions.forEach((t) => {
    if (t.type !== 'EXPENSE') return;
    if (getMonthKey(t.transactionDate) === monthKey) total += Number(t.amount);
  });
  return total;
}

function getPreviousMonthKey(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const prevDate = new Date(year, month - 2, 1);
  return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
}

// Expense total per category for one month
function getCategoryTotals(transactions, monthKey) {
  const totals = {};
  transactions.forEach((t) => {
    if (t.type !== 'EXPENSE') return;
    if (getMonthKey(t.transactionDate) !== monthKey) return;
    const category = t.category || 'Uncategorized';
    totals[category] = (totals[category] || 0) + Number(t.amount);
  });
  return totals;
}

// The categories that moved the most between two months, in rupees.
// Changes under ₹100 are ignored so the list is not filled with noise.
function getChangeDrivers(transactions, monthKey, compareKey) {
  if (!compareKey) return [];
  const current = getCategoryTotals(transactions, monthKey);
  const previous = getCategoryTotals(transactions, compareKey);

  const categories = new Set([...Object.keys(current), ...Object.keys(previous)]);
  const drivers = [];

  categories.forEach((category) => {
    const cur = current[category] || 0;
    const prev = previous[category] || 0;
    const diff = cur - prev;
    if (Math.abs(diff) >= 100) {
      drivers.push({ category, cur, prev, diff });
    }
  });

  drivers.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  return drivers.slice(0, 3);
}

function getTopCategory(transactions, monthKey) {
  const totals = getCategoryTotals(transactions, monthKey);
  const entries = Object.entries(totals);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { category: entries[0][0], amount: entries[0][1] };
}

function getBiggestTransaction(transactions, monthKey) {
  let biggest = null;
  transactions.forEach((t) => {
    if (t.type !== 'EXPENSE') return;
    if (getMonthKey(t.transactionDate) !== monthKey) return;

    const amount = Number(t.amount);
    if (!biggest || amount > biggest.amount) {
      biggest = { amount, merchant: t.merchant || 'Unknown', category: t.category, date: t.transactionDate };
    }
  });
  return biggest;
}

// Categories where this month is at least 50% above the average of the other months
function getSpendingSpikes(transactions, monthKey, availableMonths) {
  const otherMonths = availableMonths.filter((m) => m !== monthKey);
  if (otherMonths.length === 0) return [];

  const categoryTotalsByMonth = {};

  transactions.forEach((t) => {
    if (t.type !== 'EXPENSE') return;
    const key = getMonthKey(t.transactionDate);
    if (!key || !availableMonths.includes(key)) return;

    if (!categoryTotalsByMonth[t.category]) categoryTotalsByMonth[t.category] = {};
    categoryTotalsByMonth[t.category][key] = (categoryTotalsByMonth[t.category][key] || 0) + Number(t.amount);
  });

  const spikes = [];

  Object.entries(categoryTotalsByMonth).forEach(([category, monthTotals]) => {
    const currentAmount = monthTotals[monthKey] || 0;
    if (currentAmount === 0) return;

    const otherAmounts = otherMonths.map((m) => monthTotals[m] || 0);
    const average = otherAmounts.reduce((sum, val) => sum + val, 0) / otherAmounts.length;

    if (average === 0) return;

    const percentAboveAverage = ((currentAmount - average) / average) * 100;
    if (percentAboveAverage >= 50) {
      spikes.push({ category, currentAmount, average, percentAboveAverage });
    }
  });

  return spikes;
}

function formatMonthLabel(monthKey) {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

// The numbers sent to the AI. Built in one place so "look for saved tips" and
// "generate tips" always send exactly the same thing.
// Nothing here depends on the Compare-with dropdown.
function buildTipStats(transactions, monthKey, availableMonths) {
  const total = getTotalExpenseForMonth(transactions, monthKey);
  const top = getTopCategory(transactions, monthKey);
  const biggest = getBiggestTransaction(transactions, monthKey);
  const spikes = getSpendingSpikes(transactions, monthKey, availableMonths);

  return {
    month: formatMonthLabel(monthKey),
    totalSpent: total,
    topCategory: top ? `${top.category} (₹${top.amount.toFixed(0)})` : 'None',
    biggestTransaction: biggest
      ? `₹${biggest.amount.toFixed(0)} at ${biggest.merchant} (${biggest.category})`
      : 'None',
    spikes: spikes.map(
      (s) => `${s.category}: ₹${s.currentAmount.toFixed(0)} vs avg ₹${s.average.toFixed(0)} (${s.percentAboveAverage.toFixed(0)}% spike)`
    ),
  };
}

function StatChip({ icon, label, value, valueClass = 'text-text' }) {
  return (
    <div className="bg-bg border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-3.5 flex items-center gap-3.5">
      <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className={`font-semibold text-sm sm:text-base truncate ${valueClass}`} title={value}>{value}</p>
      </div>
    </div>
  );
}

/* ---------- Main Component ---------- */

function SpendingInsights({ transactions = [] }) {
  const availableMonths = getAvailableMonthKeys(transactions);

  const [selectedMonth, setSelectedMonth] = useState(null);
  const [compareMonth, setCompareMonth] = useState(null);

  const [tips, setTips] = useState(null);
  const [showTips, setShowTips] = useState(false);
  const [hasGeneratedTips, setHasGeneratedTips] = useState(false);
  const [loadingTips, setLoadingTips] = useState(false);
  const [tipsError, setTipsError] = useState(null);

  useEffect(() => {
    if (availableMonths.length > 0 && (!selectedMonth || !availableMonths.includes(selectedMonth))) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // Whenever the month (or the data) changes, quietly check whether tips for these
  // exact numbers are already saved. If so, show the View Tips button straight away.
  useEffect(() => {
    if (!selectedMonth) return;
    const months = getAvailableMonthKeys(transactions);
    if (!months.includes(selectedMonth)) return;

    let cancelled = false;
    const stats = buildTipStats(transactions, selectedMonth, months);

    getCachedSuggestions(stats)
      .then((saved) => {
        if (cancelled) return;
        if (Array.isArray(saved) && saved.length > 0) {
          setTips(saved);
          setHasGeneratedTips(true);
          setShowTips(false);
        } else {
          setTips(null);
          setHasGeneratedTips(false);
          setShowTips(false);
        }
      })
      .catch(() => {
        // Not being able to check is fine: the Generate button still works
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMonth, transactions]);

  if (availableMonths.length === 0) return <p className="text-gray-400 text-sm">No transaction data available yet.</p>;
  if (!selectedMonth) return <p className="text-gray-400 text-sm">Loading spending insights...</p>;

  const currentTotal = getTotalExpenseForMonth(transactions, selectedMonth);
  const spikes = getSpendingSpikes(transactions, selectedMonth, availableMonths);

  const autoPreviousKey = getPreviousMonthKey(selectedMonth);
  const effectiveCompareMonth = compareMonth || (availableMonths.includes(autoPreviousKey) ? autoPreviousKey : null);
  const hasComparison = Boolean(effectiveCompareMonth) && effectiveCompareMonth !== selectedMonth;

  const drivers = hasComparison ? getChangeDrivers(transactions, selectedMonth, effectiveCompareMonth) : [];

  let comparisonText = 'No prior data';
  let difference = null;

  if (hasComparison) {
    const previousTotal = getTotalExpenseForMonth(transactions, effectiveCompareMonth);
    const compareLabel = formatMonthLabel(effectiveCompareMonth);

    if (previousTotal === 0) {
      comparisonText = `No expense data for ${compareLabel}`;
    } else {
      difference = currentTotal - previousTotal;
      const direction = difference >= 0 ? 'more' : 'less';
      comparisonText = `${formatRupees(Math.abs(difference))} ${direction} than ${compareLabel}`;
    }
  }

  const handleMonthChange = (newMonth) => {
    setSelectedMonth(newMonth);
    setCompareMonth(null);
    setTips(null);
    setShowTips(false);
    setHasGeneratedTips(false);
    setTipsError(null);
  };

  const handleFetchOrToggleTips = async () => {
    if (tips && tips.length > 0) {
      setShowTips(!showTips);
      return;
    }

    setLoadingTips(true);
    setTipsError(null);

    try {
      const stats = buildTipStats(transactions, selectedMonth, availableMonths);
      const result = await getSavingsSuggestions(stats);

      if (!Array.isArray(result) || result.length === 0) {
        setTipsError('Could not generate tips right now. Please try again in a bit.');
        return;
      }

      setTips(result);
      setHasGeneratedTips(true);
      setShowTips(true);
    } catch (err) {
      setTipsError(err.message || 'Failed to fetch insights.');
    } finally {
      setLoadingTips(false);
    }
  };

  const rose = difference !== null && difference > 0;
  const fell = difference !== null && difference < 0;

  return (
    <div className="space-y-5">
      {/* Header & Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-text flex items-center gap-2">
          <Sparkles size={20} className="text-primary" /> AI Financial Insights
        </h2>

        <div className="inline-flex items-center gap-2.5 bg-bg border border-gray-200/60 dark:border-gray-700/60 rounded-xl px-3.5 py-2 self-start sm:self-auto">
          <Calendar size={16} className="text-primary" />
          <select
            value={selectedMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="bg-transparent text-sm font-semibold text-text focus:outline-none cursor-pointer"
          >
            {availableMonths.map((key) => (
              <option key={key} value={key} className="bg-card text-text">
                {formatMonthLabel(key)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <StatChip icon={<TrendingDown size={18} />} label="Total spent" value={formatRupees(currentTotal)} valueClass="text-danger" />
        <StatChip
          icon={fell ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
          label={hasComparison ? `Vs. ${formatMonthLabel(effectiveCompareMonth)}` : 'Vs. prior month'}
          value={comparisonText}
          valueClass={fell ? 'text-success' : rose ? 'text-danger' : 'text-text'}
        />
      </div>

      {/* What changed (the Compare-with dropdown lives here because it only drives this card) */}
      {availableMonths.length > 1 && (
        <div className="bg-bg border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-sm font-semibold text-text">What changed</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Compare with</span>
              <select
                value={compareMonth || ''}
                onChange={(e) => setCompareMonth(e.target.value || null)}
                className="border border-gray-300 dark:border-gray-600 bg-card text-text rounded-lg px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary transition cursor-pointer"
              >
                <option value="" className="bg-card text-text">Auto (previous month)</option>
                {availableMonths.filter((m) => m !== selectedMonth).map((key) => (
                  <option key={key} value={key} className="bg-card text-text">
                    {formatMonthLabel(key)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!hasComparison ? (
            <p className="text-sm text-gray-400">
              There is no earlier month to compare with automatically. Pick one from the list above.
            </p>
          ) : drivers.length === 0 ? (
            <p className="text-sm text-gray-400">
              No category moved by much, so your spending pattern stayed about the same.
            </p>
          ) : (
            <ul className="space-y-2">
              {drivers.map((d) => {
                const up = d.diff > 0;
                return (
                  <li key={d.category} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {up ? (
                        <ArrowUpRight size={16} className="text-danger shrink-0" />
                      ) : (
                        <ArrowDownRight size={16} className="text-success shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text truncate">{d.category}</p>
                        <p className="text-xs text-gray-400">
                          {formatRupees(d.prev)} → {formatRupees(d.cur)}
                        </p>
                      </div>
                    </div>
                    <p className={`text-sm font-bold whitespace-nowrap ${up ? 'text-danger' : 'text-success'}`}>
                      {up ? '+' : '-'}{formatRupees(Math.abs(d.diff))}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Higher than usual (this month vs the average of your other months) */}
      {spikes.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-2 animate-fadeIn">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
            <AlertTriangle size={17} /> Higher than your usual
          </p>
          <ul className="space-y-1.5 pl-6 list-disc">
            {spikes.map((spike) => (
              <li key={spike.category} className="text-sm text-text">
                <strong className="font-semibold">{spike.category}</strong>: ₹{spike.currentAmount.toFixed(0)} this month vs ₹{spike.average.toFixed(0)} on average ({spike.percentAboveAverage.toFixed(0)}% higher).
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tips action bar */}
      <div className="bg-bg border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <p className="text-xs sm:text-sm text-gray-400 font-medium">
          Tips are based on this month's spending compared with your usual.
        </p>

        <button
          onClick={handleFetchOrToggleTips}
          disabled={loadingTips}
          className="bg-primary text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-2xs cursor-pointer"
        >
          {loadingTips ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Analyzing Transactions...</span>
            </>
          ) : hasGeneratedTips || tips ? (
            <>
              {showTips ? <EyeOff size={16} /> : <Eye size={16} />}
              <span>{showTips ? 'Hide Tips' : 'View Tips'}</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>Generate Smart Insights</span>
            </>
          )}
        </button>
      </div>

      {tipsError && <p className="text-sm font-semibold text-danger px-1">{tipsError}</p>}

      {/* Clean 3-Column Recommendations Grid (Togglable) */}
      {tips && showTips && (
        <div className="space-y-3 animate-fadeIn pt-1">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
            Tailored Recommendations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {tips.map((tip, i) => (
              <div
                key={i}
                className="bg-bg hover:bg-card border border-gray-200/60 dark:border-gray-700/60 hover:border-primary/40 rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 shadow-xs hover:shadow-md"
              >
                <div className="space-y-2.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                    <Lightbulb size={12} /> Tip #{i + 1}
                  </span>
                  <p className="text-xs text-text leading-relaxed font-medium">
                    {tip}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SpendingInsights;