import { useState, useEffect } from 'react';
import { getSavingsSuggestions } from '../api/insights';
import { Calendar, TrendingUp, TrendingDown, Award, Zap, AlertTriangle, Sparkles } from 'lucide-react';

function getAvailableMonthKeys(transactions) {
  const keys = new Set();
  transactions.forEach((t) => {
    const date = new Date(t.transactionDate);
    keys.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  });
  return Array.from(keys).sort().reverse();
}

function getTotalExpenseForMonth(transactions, monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  let total = 0;
  transactions.forEach((t) => {
    if (t.type !== 'EXPENSE') return;
    const date = new Date(t.transactionDate);
    if (date.getFullYear() === year && date.getMonth() + 1 === month) {
      total += Number(t.amount);
    }
  });
  return total;
}

function getPreviousMonthKey(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const prevDate = new Date(year, month - 2, 1);
  return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
}

function getTopCategory(transactions, monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const totals = {};

  transactions.forEach((t) => {
    if (t.type !== 'EXPENSE') return;
    const date = new Date(t.transactionDate);
    if (date.getFullYear() !== year || date.getMonth() + 1 !== month) return;
    totals[t.category] = (totals[t.category] || 0) + Number(t.amount);
  });

  const entries = Object.entries(totals);
  if (entries.length === 0) return null;

  entries.sort((a, b) => b[1] - a[1]);
  return { category: entries[0][0], amount: entries[0][1] };
}

function getBiggestTransaction(transactions, monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  let biggest = null;

  transactions.forEach((t) => {
    if (t.type !== 'EXPENSE') return;
    const date = new Date(t.transactionDate);
    if (date.getFullYear() !== year || date.getMonth() + 1 !== month) return;

    const amount = Number(t.amount);
    if (!biggest || amount > biggest.amount) {
      biggest = { amount, merchant: t.merchant, category: t.category, date: t.transactionDate };
    }
  });

  return biggest;
}

function getSpendingSpikes(transactions, monthKey, availableMonths) {
  const otherMonths = availableMonths.filter((m) => m !== monthKey);
  if (otherMonths.length === 0) return [];

  const categoryTotalsByMonth = {};

  transactions.forEach((t) => {
    if (t.type !== 'EXPENSE') return;
    const date = new Date(t.transactionDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!availableMonths.includes(key)) return;

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

function StatChip({ icon, label, value, valueClass = 'text-text' }) {
  return (
    <div className="bg-bg rounded-lg p-4 flex items-center gap-3">
      <div className="p-2 rounded-full bg-primary/10 text-primary shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className={`font-semibold ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}

function SpendingInsights({ transactions }) {
  const availableMonths = getAvailableMonthKeys(transactions);

  const [selectedMonth, setSelectedMonth] = useState(null);
  const [compareMonth, setCompareMonth] = useState(null);

  const [tips, setTips] = useState(null);
  const [loadingTips, setLoadingTips] = useState(false);
  const [tipsError, setTipsError] = useState(null);

  useEffect(() => {
    if (!selectedMonth && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  if (availableMonths.length === 0) return <p className="text-gray-400 text-sm">No transaction data yet.</p>;
  if (!selectedMonth) return <p className="text-gray-400 text-sm">Loading insights...</p>;

  const currentTotal = getTotalExpenseForMonth(transactions, selectedMonth);
  const topCategory = getTopCategory(transactions, selectedMonth);
  const biggestTransaction = getBiggestTransaction(transactions, selectedMonth);
  const spikes = getSpendingSpikes(transactions, selectedMonth, availableMonths);

  const autoPreviousKey = getPreviousMonthKey(selectedMonth);
  const effectiveCompareMonth = compareMonth || (availableMonths.includes(autoPreviousKey) ? autoPreviousKey : null);

  let comparisonText = 'No prior month data available to compare.';
  let percentChangeVal = null;
  if (effectiveCompareMonth) {
    const previousTotal = getTotalExpenseForMonth(transactions, effectiveCompareMonth);
    percentChangeVal = previousTotal === 0 ? null : ((currentTotal - previousTotal) / previousTotal) * 100;

    const compareLabel = new Date(...effectiveCompareMonth.split('-').map((n, i) => i === 1 ? n - 1 : n))
      .toLocaleString('default', { month: 'long', year: 'numeric' });

    if (percentChangeVal === null) {
      comparisonText = `${compareLabel} had no recorded spending to compare against.`;
    } else {
      const direction = percentChangeVal >= 0 ? 'more' : 'less';
      comparisonText = `You spent ${Math.abs(percentChangeVal).toFixed(1)}% ${direction} than ${compareLabel}.`;
    }
  }

  const handleGetSavingsTips = async () => {
    setLoadingTips(true);
    setTipsError(null);
    setTips(null);

    try {
      const stats = {
        totalSpent: currentTotal,
        topCategory: topCategory ? `${topCategory.category} (₹${topCategory.amount.toFixed(0)})` : 'None',
        biggestTransaction: biggestTransaction
          ? `₹${biggestTransaction.amount.toFixed(0)} at ${biggestTransaction.merchant} (${biggestTransaction.category})`
          : 'None',
        monthOverMonth: comparisonText,
        spikes: spikes.map((s) => `${s.category}: ₹${s.currentAmount.toFixed(0)} this month vs ₹${s.average.toFixed(0)} average (${s.percentAboveAverage.toFixed(0)}% above)`),
      };

      const result = await getSavingsSuggestions(stats);
      setTips(result);
    } catch (err) {
      setTipsError(err.message);
    } finally {
      setLoadingTips(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text">Spending Insights</h2>
        <div className="inline-flex items-center gap-2 bg-bg border border-gray-300 dark:border-gray-600 rounded-full px-3 py-1.5">
          <Calendar size={16} className="text-secondary" />
          <select
            value={selectedMonth}
            onChange={(e) => { setSelectedMonth(e.target.value); setCompareMonth(null); }}
            className="bg-transparent text-sm font-medium text-text focus:outline-none"
          >
            {availableMonths.map((key) => {
              const label = new Date(...key.split('-').map((n, i) => i === 1 ? n - 1 : n))
                .toLocaleString('default', { month: 'long', year: 'numeric' });
              return <option key={key} value={key} className="bg-card text-text">{label}</option>;
            })}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <StatChip icon={<TrendingDown size={18} />} label="Total spent" value={`₹${currentTotal.toFixed(0)}`} valueClass="text-danger" />
        {topCategory && (
          <StatChip icon={<Award size={18} />} label="Biggest category" value={`${topCategory.category} · ₹${topCategory.amount.toFixed(0)}`} />
        )}
        {biggestTransaction && (
          <StatChip icon={<Zap size={18} />} label="Biggest transaction" value={`₹${biggestTransaction.amount.toFixed(0)} · ${biggestTransaction.merchant}`} />
        )}
        <StatChip
          icon={percentChangeVal !== null && percentChangeVal < 0 ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
          label="Vs. previous month"
          value={comparisonText}
          valueClass={percentChangeVal !== null && percentChangeVal < 0 ? 'text-success' : percentChangeVal !== null ? 'text-danger' : 'text-text'}
        />
      </div>

      {spikes.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-4">
          <p className="flex items-center gap-2 text-sm font-medium text-warning mb-2">
            <AlertTriangle size={16} /> Unusual spending detected
          </p>
          <ul className="space-y-1">
            {spikes.map((spike) => (
              <li key={spike.category} className="text-sm text-text">
                <strong>{spike.category}</strong>: ₹{spike.currentAmount.toFixed(0)} this month vs ₹{spike.average.toFixed(0)} average
                ({spike.percentAboveAverage.toFixed(0)}% above)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <label className="text-sm text-gray-400 whitespace-nowrap">Compare against:</label>
        <select
          value={compareMonth || ''}
          onChange={(e) => setCompareMonth(e.target.value || null)}
          className="border border-gray-300 dark:border-gray-600 bg-card text-text rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
        >
          <option value="" className="bg-card text-text">Auto (previous month)</option>
          {availableMonths.filter((m) => m !== selectedMonth).map((key) => {
            const label = new Date(...key.split('-').map((n, i) => i === 1 ? n - 1 : n))
              .toLocaleString('default', { month: 'long', year: 'numeric' });
            return <option key={key} value={key} className="bg-card text-text">{label}</option>;
          })}
        </select>
      </div>

      <button
        onClick={handleGetSavingsTips}
        disabled={loadingTips}
        className="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
      >
        <Sparkles size={16} /> {loadingTips ? 'Getting tips...' : 'Get Savings Tips'}
      </button>

      {tipsError && <p className="text-danger text-sm mt-2">Error: {tipsError}</p>}

      {tips && (
        <ul className="mt-4 space-y-2">
          {tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 bg-primary/10 rounded-lg p-3 text-sm text-text">
              <Sparkles size={16} className="text-primary shrink-0 mt-0.5" /> {tip}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SpendingInsights;