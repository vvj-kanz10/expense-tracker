import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = [
  '#6366f1', '#22c55e', '#f97316', '#ec4899', '#06b6d4',
  '#eab308', '#8b5cf6', '#ef4444', '#14b8a6', '#84cc16'
];

const ALL_TIME = 'All Time';

function getMonthKey(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function getAvailableMonths(transactions) {
  const months = new Set();
  transactions.forEach((tx) => {
    if (tx.transactionDate) months.add(getMonthKey(tx.transactionDate));
  });
  return Array.from(months).sort((a, b) => new Date(b) - new Date(a));
}

function groupByCategorySpending(transactions, selectedMonth) {
  const totals = {};

  transactions.forEach((tx) => {
    if (tx.type === 'INCOME' || tx.category === 'Income') return;

    if (selectedMonth !== ALL_TIME && getMonthKey(tx.transactionDate) !== selectedMonth) {
      return;
    }

    const category = tx.category || 'Other/People';
    const amount = Math.abs(Number(tx.amount) || 0);
    totals[category] = (totals[category] || 0) + amount;
  });

  return Object.keys(totals).map((category) => ({
    name: category,
    value: totals[category],
  }));
}

// Custom tooltip showing Category in slice color + Amount only
function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const { name, value, fill } = payload[0];
    const formattedAmount = `₹${Number(value).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    return (
      <div className="bg-card border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl p-3 text-text min-w-[140px] pointer-events-none">
        <p className="text-xs font-bold mb-0.5" style={{ color: fill }}>
          {name}
        </p>
        <p className="text-base font-extrabold text-text">{formattedAmount}</p>
      </div>
    );
  }

  return null;
}

function CategoryPieChart({ transactions }) {
  const availableMonths = getAvailableMonths(transactions);
  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0] || ALL_TIME);

  const data = groupByCategorySpending(transactions, selectedMonth);
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="flex flex-col h-full justify-between">
      {/* Header with Title and Month Selector aligned on the same row */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold text-text">Spending by Category</h2>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 bg-card text-text rounded-xl px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary transition"
        >
          <option value={ALL_TIME} className="bg-card text-text">{ALL_TIME}</option>
          {availableMonths.map((month) => (
            <option key={month} value={month} className="bg-card text-text">{month}</option>
          ))}
        </select>
      </div>

      {data.length === 0 ? (
        <p className="text-gray-400 text-sm py-12 text-center">No spending data for this period.</p>
      ) : (
        <div className="w-full h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} stroke="none" />
                ))}
              </Pie>

              <Tooltip content={<CustomTooltip />} isAnimationActive={false} />

              <Legend
                formatter={(value, entry) => {
                  const percent = total > 0 ? ((entry.payload.value / total) * 100).toFixed(1) : 0;
                  return <span className="text-xs text-text font-medium">{value} ({percent}%)</span>;
                }}
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default CategoryPieChart;