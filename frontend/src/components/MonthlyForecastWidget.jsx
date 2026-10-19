import { useState, useEffect } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle2, ShieldAlert, CalendarClock } from 'lucide-react';
import { getForecast } from '../api/forecast';

function formatCurrency(amount) {
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// A thin bar that grows from empty to its width when it appears
function Bar({ percent, colorClass = 'bg-primary' }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(Math.max(0, Math.min(100, percent))));
    return () => cancelAnimationFrame(id);
  }, [percent]);

  return (
    <div className="h-2.5 rounded-full bg-gray-200/70 dark:bg-gray-700/60 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function ForecastSkeleton() {
  return (
    <div className="bg-white dark:bg-[#131c2e] rounded-2xl shadow-sm p-6 border border-gray-200/80 dark:border-gray-800/80 space-y-5 animate-pulse">
      <div className="h-5 w-56 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-16 rounded-xl bg-gray-200 dark:bg-gray-700" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="h-24 rounded-xl bg-gray-200 dark:bg-gray-700" />
        <div className="h-24 rounded-xl bg-gray-200 dark:bg-gray-700" />
        <div className="h-24 rounded-xl bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

const STATUS_STYLES = {
  OVER: {
    card: 'border-rose-500/30 bg-rose-500/5',
    pill: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    label: 'Over',
  },
  AT_RISK: {
    card: 'border-amber-500/30 bg-amber-500/5',
    pill: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    label: 'At risk',
  },
  OK: {
    card: 'border-gray-200/60 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a2333]/50',
    pill: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    label: 'On track',
  },
};

export default function MonthlyForecastWidget() {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetches forecast for the latest running month
    getForecast()
      .then((data) => setForecast(data))
      .catch((err) => setError(err.message || 'Failed to load forecast'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ForecastSkeleton />;
  if (error || !forecast || forecast.status === 'NO_DATA') return null;

  if (forecast.status === 'COMPLETE' || forecast.status === 'TOO_EARLY') {
    return (
      <div className="bg-white dark:bg-[#131c2e] rounded-2xl shadow-sm p-6 border border-gray-200/80 dark:border-gray-800/80 animate-fadeIn">
        <div className="flex items-center gap-2 text-primary font-semibold text-base mb-2">
          <TrendingUp size={18} />
          <span>Month-End Forecast ({forecast.month})</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{forecast.message}</p>
      </div>
    );
  }

  const leftoverPositive = forecast.projectedLeftover >= 0;
  const monthPercent = forecast.daysInMonth > 0 ? (forecast.daysElapsed / forecast.daysInMonth) * 100 : 0;
  const spendPercent = forecast.projectedTotal > 0 ? (forecast.spentSoFar / forecast.projectedTotal) * 100 : 0;
  const daysLeft = Math.max(0, forecast.daysInMonth - forecast.daysElapsed);

  return (
    <div className="bg-white dark:bg-[#131c2e] rounded-2xl shadow-sm p-6 border border-gray-200/80 dark:border-gray-800/80 space-y-6 animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-primary font-semibold text-base">
          <TrendingUp size={18} />
          <span>Month-End Forecast ({forecast.month})</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
          <CalendarClock size={13} />
          Day {forecast.daysElapsed} of {forecast.daysInMonth} · {daysLeft} left
        </span>
      </div>

      {/* One-line answer first, numbers after */}
      <div
        className={`rounded-2xl border p-5 ${
          leftoverPositive
            ? 'border-primary/25 bg-gradient-to-br from-primary/10 to-transparent'
            : 'border-rose-500/30 bg-gradient-to-br from-rose-500/10 to-transparent'
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {leftoverPositive ? 'Expected to be left over' : 'Expected shortfall'}
        </p>
        <p className={`text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 tabular-nums ${leftoverPositive ? 'text-primary' : 'text-danger'}`}>
          {formatCurrency(Math.abs(forecast.projectedLeftover))}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
          {leftoverPositive
            ? `At your current pace you should finish ${forecast.month} with this much to spare.`
            : `At your current pace you could overspend by this much before ${forecast.month} ends.`}
        </p>
      </div>

      {/* Pace bars: how far into the month vs how much of the projected spend is gone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-500 dark:text-gray-400">Month passed</span>
            <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{monthPercent.toFixed(0)}%</span>
          </div>
          <Bar percent={monthPercent} colorClass="bg-secondary" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-500 dark:text-gray-400">Projected spend used</span>
            <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{spendPercent.toFixed(0)}%</span>
          </div>
          <Bar
            percent={spendPercent}
            colorClass={spendPercent > monthPercent + 10 ? 'bg-amber-500' : 'bg-primary'}
          />
        </div>
      </div>

      {/* Main projection stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-hover bg-gray-50 dark:bg-[#1a2333] p-4 rounded-xl border border-gray-200/60 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Projected Total Spend</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{formatCurrency(forecast.projectedTotal)}</p>
          <p className="text-xs text-gray-400 mt-1">Spent so far: {formatCurrency(forecast.spentSoFar)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Fixed bills: {formatCurrency(forecast.expectedFixed)}</p>
        </div>

        <div className="card-hover bg-gray-50 dark:bg-[#1a2333] p-4 rounded-xl border border-gray-200/60 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Expected Income</p>
          <p className="text-xl font-bold text-success mt-1 tabular-nums">{formatCurrency(forecast.expectedIncome)}</p>
          <p className="text-xs text-gray-400 mt-1">Based on historical trend</p>
        </div>

        <div className="card-hover bg-gray-50 dark:bg-[#1a2333] p-4 rounded-xl border border-gray-200/60 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Projected Leftover</p>
          <p className={`text-xl font-bold mt-1 tabular-nums ${leftoverPositive ? 'text-primary' : 'text-danger'}`}>
            {formatCurrency(forecast.projectedLeftover)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Estimated monthly savings</p>
        </div>
      </div>

      {/* Budget Outlooks */}
      {forecast.budgets && forecast.budgets.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Budget Pacing Outlook</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {forecast.budgets.map((b, idx) => {
              const style = STATUS_STYLES[b.status] || STATUS_STYLES.OK;
              const isOver = b.status === 'OVER';
              const isAtRisk = b.status === 'AT_RISK';
              return (
                <div
                  key={idx}
                  style={{ animationDelay: `${idx * 70}ms` }}
                  className={`animate-rise p-3.5 rounded-xl border flex items-start gap-3 ${style.card}`}
                >
                  <div className="mt-0.5">
                    {isOver ? <ShieldAlert size={18} className="text-danger" /> :
                     isAtRisk ? <AlertTriangle size={18} className="text-amber-500" /> :
                     <CheckCircle2 size={18} className="text-success" />}
                  </div>
                  <div className="flex-1 text-sm min-w-0">
                    <div className="flex justify-between items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">{b.category}</span>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${style.pill}`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300">{b.message}</p>
                    <p className="text-xs text-gray-400 mt-1">Limit: {formatCurrency(b.limitAmount)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}