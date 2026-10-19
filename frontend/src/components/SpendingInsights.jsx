import { useState, useEffect, useRef } from 'react';
import { generatePersonalTips, getCachedPersonalTips } from '../api/personalTips';
import { getChargeInsights } from '../api/charges';
import {
  Calendar, TrendingUp, TrendingDown, Loader2,
  ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp,
  HandCoins, ArrowRight, ListChecks, CreditCard,
  GitCompareArrows, ChartColumnIncreasing, CalendarSync, ScanSearch, ShieldCheck,
  Utensils, ShoppingBasket, Bus, ShoppingBag, Zap, Clapperboard, Dumbbell, Building2, Tag, Banknote,
} from 'lucide-react';

/* ---------- Helper Functions ---------- */

function formatRupees(amount) {
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
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

/* ---------- Small UI pieces ---------- */

// A thin bar that grows from empty to its width when it appears
function Bar({ percent, colorClass = 'bg-primary' }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(percent));
    return () => cancelAnimationFrame(id);
  }, [percent]);

  return (
    <div className="h-2 rounded-full bg-gray-200/70 dark:bg-gray-700/60 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
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
      <p className="text-xs text-gray-400 max-w-[240px]">{hint}</p>
    </div>
  );
}

const CATEGORY_ICONS = {
  'Food & Dining': Utensils,
  'Groceries': ShoppingBasket,
  'Transport': Bus,
  'Shopping': ShoppingBag,
  'Bills & Utilities': Zap,
  'Entertainment': Clapperboard,
  'Health & Fitness': Dumbbell,
  'Rent/Housing': Building2,
  'Withdrawal': Banknote,
};

const LOADING_STEPS = [
  'Reading your transactions...',
  'Spotting spending patterns...',
  'Writing your savings tips...',
];

function TipSkeletons() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-card/70 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-5 space-y-3 animate-pulse"
        >
          <div className="h-5 w-24 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 rounded bg-gray-200 dark:bg-gray-700 w-11/12" />
          <div className="h-3 rounded bg-gray-200 dark:bg-gray-700 w-3/4" />
        </div>
      ))}
    </div>
  );
}

// A select with our own small arrow (the browser's default arrow looks oversized)
function SelectBox({ value, onChange, children, className = '' }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className={`appearance-none cursor-pointer focus:outline-none ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"
      />
    </div>
  );
}

const rowClass =
  'flex items-center gap-3 bg-card p-3.5 rounded-xl border border-gray-200/40 dark:border-gray-700/40 transition-colors duration-200 hover:border-primary/40';

/* ---------- Main Component ---------- */

// refreshKey: change this number whenever goals or budgets change. If the user already has
// tips, they are refreshed (reused if still valid, regenerated if the numbers moved).
function SpendingInsights({ transactions = [], refreshKey = 0 }) {
  const availableMonths = getAvailableMonthKeys(transactions);

  const [selectedMonth, setSelectedMonth] = useState(null);
  const [compareMonth, setCompareMonth] = useState(null);
  const [detailTab, setDetailTab] = useState('changes');

  const [tips, setTips] = useState(null);
  const [showTips, setShowTips] = useState(false);
  const [hasGeneratedTips, setHasGeneratedTips] = useState(false);
  const [loadingTips, setLoadingTips] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [tipsError, setTipsError] = useState(null);

  // Recurring bills + unusual charges (lifetime data)
  const [charges, setCharges] = useState(null);
  const [chargesLoading, setChargesLoading] = useState(true);
  const [chargesError, setChargesError] = useState(null);

  const isFirstRefresh = useRef(true);
  const hasTipsRef = useRef(false);
  hasTipsRef.current = Boolean(tips && tips.length > 0);

  useEffect(() => {
    if (availableMonths.length > 0 && (!selectedMonth || !availableMonths.includes(selectedMonth))) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // While the AI is working, rotate the status line so it feels alive
  useEffect(() => {
    if (!loadingTips) {
      setLoadingStep(0);
      return undefined;
    }
    const id = setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 1800);
    return () => clearInterval(id);
  }, [loadingTips]);

  // Only changes when the data really changes (the parent hands us a brand new
  // transactions array on almost every render, so we cannot watch the array itself).
  const transactionCount = transactions.length;

  // Whenever the month or the data changes, quietly check whether tips are already saved.
  // The server compares against the current numbers, so old tips never show for new data.
  useEffect(() => {
    if (!selectedMonth) return undefined;

    let cancelled = false;

    getCachedPersonalTips(selectedMonth)
      .then((saved) => {
        if (cancelled) return;
        if (Array.isArray(saved) && saved.length > 0) {
          setTips(saved);
          setHasGeneratedTips(true);
          setShowTips(true);
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
  }, [selectedMonth, transactionCount]);

  // Goals or budgets changed: if the user already has tips, make sure they are still valid.
  // Saved tips that still match are kept; otherwise fresh ones are generated automatically.
  useEffect(() => {
    if (isFirstRefresh.current) {
      isFirstRefresh.current = false;
      return undefined;
    }
    if (!selectedMonth || !hasTipsRef.current) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const saved = await getCachedPersonalTips(selectedMonth);
        if (cancelled) return;

        if (Array.isArray(saved) && saved.length > 0) {
          setTips(saved);
          return;
        }

        setLoadingTips(true);
        setTipsError(null);
        const result = await generatePersonalTips(selectedMonth);
        if (cancelled) return;

        if (Array.isArray(result) && result.length > 0) {
          setTips(result);
          setHasGeneratedTips(true);
          setShowTips(true);
        } else {
          setTipsError('Your goals changed, but new tips could not be generated right now.');
        }
      } catch (err) {
        if (!cancelled) setTipsError(err.message || 'Failed to refresh your tips.');
      } finally {
        if (!cancelled) setLoadingTips(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Recurring bills + unusual charges
  useEffect(() => {
    setChargesLoading(true);
    setChargesError(null);
    // null = look across all data, not one month
    getChargeInsights(null)
      .then((data) => setCharges(data))
      .catch((err) => setChargesError(err.message || 'Failed to load charge insights.'))
      .finally(() => setChargesLoading(false));
  }, [refreshKey, transactionCount]);

  if (availableMonths.length === 0) return <p className="text-gray-400 text-sm">No transaction data available yet.</p>;
  if (!selectedMonth) return <p className="text-gray-400 text-sm">Loading spending insights...</p>;

  const currentTotal = getTotalExpenseForMonth(transactions, selectedMonth);
  const spikes = getSpendingSpikes(transactions, selectedMonth, availableMonths);
  const topCategory = getTopCategory(transactions, selectedMonth);

  const autoPreviousKey = getPreviousMonthKey(selectedMonth);
  const effectiveCompareMonth = compareMonth || (availableMonths.includes(autoPreviousKey) ? autoPreviousKey : null);
  const hasComparison = Boolean(effectiveCompareMonth) && effectiveCompareMonth !== selectedMonth;
  const compareLabel = hasComparison ? formatMonthLabel(effectiveCompareMonth) : '';

  const drivers = hasComparison ? getChangeDrivers(transactions, selectedMonth, effectiveCompareMonth) : [];
  const maxDriverDiff = drivers.reduce((max, d) => Math.max(max, Math.abs(d.diff)), 0);

  let comparisonText = 'No earlier month to compare';
  let difference = null;
  let percentChange = null;

  if (hasComparison) {
    const previousTotal = getTotalExpenseForMonth(transactions, effectiveCompareMonth);

    if (previousTotal === 0) {
      comparisonText = `No expense data for ${compareLabel}`;
    } else {
      difference = currentTotal - previousTotal;
      percentChange = (difference / previousTotal) * 100;
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
      const result = await generatePersonalTips(selectedMonth);

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

  const deltaIconTone = rose
    ? 'bg-rose-500/10 text-rose-500'
    : fell
      ? 'bg-emerald-500/10 text-emerald-500'
      : 'bg-primary/10 text-primary';
  const deltaValueTone = rose ? 'text-danger' : fell ? 'text-success' : 'text-text';
  const deltaPillTone = rose
    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';

  const cardClass = 'bg-bg border border-gray-200/60 dark:border-gray-700/60 rounded-2xl';
  const hasTips = Boolean(tips && tips.length > 0);
  const totalSaving = hasTips ? tips.reduce((sum, t) => sum + Number(t.monthlySaving || 0), 0) : 0;

  // Translate the backend's field names into the ones this card uses
  const recurringList = (charges?.recurring || charges?.recurringCharges || []).map((r) => ({
    merchantName: displayName(r.name ?? r.merchantName, r.description),
    category: r.category,
    typicalAmount: r.typicalAmount,
    occurrenceCount: r.timesSeen ?? r.occurrenceCount,
    lastDate: r.lastDate,
  }));
  const unusualList = (charges?.unusual || charges?.unusualCharges || []).map((u) => ({
    transactionId: u.transactionId,
    name: displayName(u.merchant, u.description),
    category: u.category,
    date: u.date,
    amount: u.amount,
    typicalCategoryMedian: u.typicalAmount ?? u.typicalCategoryMedian,
  }));
  const recurringTotal = Number(charges?.recurringMonthlyTotal ?? charges?.totalRecurringMonthly ?? 0);

  // Tabs of the detail card (the first two only appear when there is something to show)
 const tabs = [];
if (availableMonths.length > 1) tabs.push({ id: 'changes', label: 'What changed', icon: GitCompareArrows });
if (spikes.length > 0) tabs.push({ id: 'usual', label: 'Above average', icon: ChartColumnIncreasing, count: spikes.length });
tabs.push({ id: 'recurring', label: 'Recurring bills', icon: CalendarSync });
tabs.push({
  id: 'unusual',
  label: 'Unusual charges',
  icon: ScanSearch,
  count: unusualList.length > 0 ? unusualList.length : null,
});

  const activeTab = tabs.some((t) => t.id === detailTab) ? detailTab : tabs[0].id;

  const tabClass = (name) =>
    `flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition cursor-pointer ${
      activeTab === name
        ? 'bg-primary/10 text-primary'
        : 'text-gray-500 dark:text-gray-400 hover:text-text'
    }`;

  return (
    <div className="space-y-5">
      {/* AI hero: the headline feature. Month picker + the AI tips live together here. */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-5 sm:p-6 space-y-5">
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary text-white shadow-md shadow-primary/30">
              <HandCoins size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-text">AI Financial Insights</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary">
                  Gemini
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Personal savings moves for {formatMonthLabel(selectedMonth)}
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2.5 bg-card/80 border border-gray-200/60 dark:border-gray-700/60 rounded-xl pl-3.5 pr-2 py-2 self-start sm:self-auto">
            <Calendar size={16} className="text-primary" />
            <SelectBox
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="bg-transparent text-sm font-semibold text-text pr-6"
            >
              {availableMonths.map((key) => (
                <option key={key} value={key} className="bg-card text-text">
                  {formatMonthLabel(key)}
                </option>
              ))}
            </SelectBox>
          </div>
        </div>

        <div className="relative">
          {loadingTips && (
            <div className="space-y-4 animate-fadeIn">
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <Loader2 size={16} className="animate-spin" />
                <span key={loadingStep} className="animate-fadeIn">{LOADING_STEPS[loadingStep]}</span>
              </p>
              <TipSkeletons />
            </div>
          )}

          {!loadingTips && hasTips && showTips && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {tips.length} savings moves{totalSaving > 0 ? ` · about ${formatRupees(totalSaving)} a month` : ''}
                </h3>
                <button
                  onClick={handleFetchOrToggleTips}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-primary transition cursor-pointer shrink-0"
                >
                  <ChevronUp size={14} /> Hide
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {tips.map((tip, i) => {
                  const TipIcon = CATEGORY_ICONS[tip.category] || Tag;
                  return (
                    <div
                      key={i}
                      style={{ animationDelay: `${i * 90}ms` }}
                      className="animate-rise bg-card border border-gray-200/60 dark:border-gray-700/60 hover:border-primary/40 rounded-2xl p-5 flex flex-col gap-3 transition-all duration-300 shadow-xs hover:shadow-md"
                    >
                      <span className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                        <TipIcon size={13} /> {tip.category}
                      </span>

                      <p className="text-sm font-semibold text-text leading-snug">{tip.headline}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{tip.action}</p>

                      <div className="mt-auto pt-1 space-y-2">
                        {tip.monthlySaving > 0 && (
                          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            Save about {formatRupees(tip.monthlySaving)} a month
                          </span>
                        )}

                        {(tip.evidence || tip.goalImpact) && (
                          <details className="group">
                            <summary className="list-none flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-primary cursor-pointer select-none transition">
                              <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
                              Why this tip
                            </summary>
                            <div className="mt-2 space-y-1.5">
                              {tip.evidence && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{tip.evidence}</p>
                              )}
                              {tip.goalImpact && (
                                <p className="text-xs text-primary leading-relaxed">{tip.goalImpact}</p>
                              )}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!loadingTips && !(hasTips && showTips) && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/70 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-4 sm:p-5">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                  <ListChecks size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">
                    {hasTips ? 'Your savings tips are ready' : 'Get tips made for your spending'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    The AI studies your habits, goals and budgets, then suggests specific ways to save.
                  </p>
                </div>
              </div>

              <button
                onClick={handleFetchOrToggleTips}
                className="bg-primary text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 shadow-md shadow-primary/20 cursor-pointer whitespace-nowrap"
              >
                {hasTips ? <ChevronDown size={16} /> : <ArrowRight size={16} />}
                <span>{hasTips ? 'View Tips' : 'Generate Smart Insights'}</span>
              </button>
            </div>
          )}

          {tipsError && <p className="text-sm font-semibold text-danger px-1 mt-3">{tipsError}</p>}
        </div>
      </div>

      {/* One summary card: total spent on the left, change vs the other month on the right */}
      <div className={`${cardClass} animate-rise grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-gray-200/60 dark:divide-gray-700/60`}>
        <div className="p-5 flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
            <CreditCard size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total spent</p>
            <p className="text-2xl font-bold text-text mt-1 tracking-tight tabular-nums">{formatRupees(currentTotal)}</p>
            <p className="text-xs text-gray-400 mt-1 truncate">
              {topCategory ? `Top category: ${topCategory.category}` : 'No expenses this month'}
            </p>
          </div>
        </div>

        <div className="p-5 flex items-start gap-4 border-t sm:border-t-0 border-gray-200/60 dark:border-gray-700/60">
          <div className={`p-3 rounded-xl shrink-0 ${deltaIconTone}`}>
            {fell ? <TrendingDown size={20} /> : <TrendingUp size={20} />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {hasComparison ? `Vs. ${compareLabel}` : 'Vs. earlier month'}
            </p>
            {difference !== null ? (
              <>
                <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                  <p className={`text-2xl font-bold tracking-tight tabular-nums ${deltaValueTone}`}>
                    {difference >= 0 ? '+' : '-'}{formatRupees(Math.abs(difference))}
                  </p>
                  {percentChange !== null && Math.abs(percentChange) >= 0.5 && (
                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${deltaPillTone}`}>
                      {rose ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                      {Math.abs(percentChange).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {rose ? 'You spent more than that month' : fell ? 'You spent less than that month' : 'Same as that month'}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400 mt-2">{comparisonText}</p>
            )}
          </div>
        </div>
      </div>

      {/* One detail card with tabs: changes, above average, recurring bills, unusual charges */}
      <div className={`${cardClass} p-5 space-y-4`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="inline-flex p-1 rounded-xl bg-card border border-gray-200/60 dark:border-gray-700/60 self-start max-w-full overflow-x-auto">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button key={tab.id} type="button" onClick={() => setDetailTab(tab.id)} className={tabClass(tab.id)}>
                  <TabIcon size={14} /> {tab.label}
                  {tab.count ? (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {activeTab === 'changes' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Compare with</span>
              <SelectBox
                value={compareMonth || ''}
                onChange={(e) => setCompareMonth(e.target.value || null)}
                className="border border-gray-300 dark:border-gray-600 bg-card text-text rounded-lg pl-3 pr-7 py-1.5 text-xs sm:text-sm"
              >
                <option value="" className="bg-card text-text">Auto (previous month)</option>
                {availableMonths.filter((m) => m !== selectedMonth).map((key) => (
                  <option key={key} value={key} className="bg-card text-text">
                    {formatMonthLabel(key)}
                  </option>
                ))}
              </SelectBox>
            </div>
          )}

          {activeTab === 'recurring' && recurringTotal > 0 && (
            <span className="self-start px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary whitespace-nowrap">
              {formatRupees(recurringTotal)} / month
            </span>
          )}
        </div>

        {/* What changed */}
        {activeTab === 'changes' &&
          (!hasComparison ? (
            <p className="text-sm text-gray-400">
              There is no earlier month to compare with automatically. Pick one from the list above.
            </p>
          ) : drivers.length === 0 ? (
            <p className="text-sm text-gray-400">
              No category moved by much, so your spending pattern stayed about the same.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200/60 dark:divide-gray-700/60 animate-fadeIn">
              {drivers.map((d) => {
                const up = d.diff > 0;
                const barPercent = maxDriverDiff > 0 ? Math.max(8, (Math.abs(d.diff) / maxDriverDiff) * 100) : 0;
                return (
                  <li key={d.category} className="py-3.5 first:pt-0 last:pb-0 flex items-center gap-4">
                    <div className={`p-2 rounded-full shrink-0 ${up ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                      {up ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    </div>

                    <div className="min-w-0 flex-1 sm:flex-none sm:w-48">
                      <p className="text-sm font-semibold text-text truncate">{d.category}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatRupees(d.prev)} → {formatRupees(d.cur)}
                      </p>
                    </div>

                    <div className="hidden sm:block flex-1">
                      <Bar percent={barPercent} colorClass={up ? 'bg-rose-500' : 'bg-emerald-500'} />
                    </div>

                    <p className={`text-sm sm:text-base font-bold whitespace-nowrap text-right sm:w-28 tabular-nums ${up ? 'text-danger' : 'text-success'}`}>
                      {up ? '+' : '-'}{formatRupees(Math.abs(d.diff))}
                    </p>
                  </li>
                );
              })}
            </ul>
          ))}

        {/* Above average */}
        {activeTab === 'usual' && (
          <div className="space-y-3 animate-fadeIn">
            <p className="text-xs text-gray-400">Compared with the average of your other months.</p>
            <ul className="divide-y divide-gray-200/60 dark:divide-gray-700/60">
              {spikes.map((spike) => (
                <li key={spike.category} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text truncate">{spike.category}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatRupees(spike.currentAmount)} this month · usually {formatRupees(spike.average)}
                    </p>
                  </div>
                  <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                    +{spike.percentAboveAverage.toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recurring bills */}
        {activeTab === 'recurring' &&
          (chargesLoading ? (
            <p className="py-6 text-center text-sm text-gray-400 animate-pulse">Analyzing transaction patterns...</p>
          ) : chargesError ? (
            <p className="text-sm text-danger">{chargesError}</p>
          ) : recurringList.length === 0 ? (
            <EmptyState
              icon={<CalendarSync size={20} />}
              tone="bg-primary/10 text-primary"
              title="No recurring bills yet"
              hint="Payments that repeat every month will show up here."
            />
          ) : (
            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1 animate-fadeIn">
              <p className="text-xs text-gray-400">Repeating payments, found across all your data.</p>
              {recurringList.map((item, idx) => (
                <div key={idx} className={rowClass}>
                  <Avatar name={item.merchantName} tone="bg-primary/10 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text truncate">{item.merchantName}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {item.category} · {item.occurrenceCount}x · last {formatDate(item.lastDate)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-text whitespace-nowrap">{formatRupees(item.typicalAmount)}</p>
                </div>
              ))}
            </div>
          ))}

        {/* Unusual charges */}
        {activeTab === 'unusual' &&
          (chargesLoading ? (
            <p className="py-6 text-center text-sm text-gray-400 animate-pulse">Analyzing transaction patterns...</p>
          ) : chargesError ? (
            <p className="text-sm text-danger">{chargesError}</p>
          ) : unusualList.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={20} />}
              tone="bg-emerald-500/10 text-emerald-500"
              title="All clear"
              hint="No charges that look unusually large for their category."
            />
          ) : (
            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1 animate-fadeIn">
              <p className="text-xs text-gray-400">Single payments that are large for their category.</p>
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
                      <p className="text-sm font-bold text-danger">{formatRupees(item.amount)}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        usually {formatRupees(item.typicalCategoryMedian)}
                        {multiple && <span className="text-amber-600 dark:text-amber-400 font-medium"> · {multiple}</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
      </div>
    </div>
  );
}

export default SpendingInsights;