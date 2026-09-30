// src/components/CategoryPieChart.jsx

import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
  transactions.forEach((tx) => months.add(getMonthKey(tx.transactionDate)));

  return Array.from(months).sort(
    (a, b) => new Date(b) - new Date(a)
  );
}

function groupByCategorySpending(transactions, selectedMonth) {
  const totals = {};

  transactions.forEach((tx) => {
    if (tx.category === 'Income') return;

    if (selectedMonth !== ALL_TIME && getMonthKey(tx.transactionDate) !== selectedMonth) {
      return;
    }

    const amount = Math.abs(Number(tx.amount));
    totals[tx.category] = (totals[tx.category] || 0) + amount;
  });

  return Object.keys(totals).map((category) => ({
    name: category,
    value: totals[category],
  }));
}

function CategoryPieChart({ transactions }) {
  const availableMonths = getAvailableMonths(transactions);
  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0] || ALL_TIME);

  const data = groupByCategorySpending(transactions, selectedMonth);
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div>
      <select
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(e.target.value)}
        className="mb-4 border border-gray-300 dark:border-gray-600 bg-card text-text rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
      >
        <option value={ALL_TIME} className="bg-card text-text">{ALL_TIME}</option>
        {availableMonths.map((month) => (
          <option key={month} value={month} className="bg-card text-text">{month}</option>
        ))}
      </select>

      {data.length === 0 ? (
        <p className="text-gray-400">No spending data for this period.</p>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={120}
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `₹${value.toFixed(2)}`} />
            <Legend formatter={(value, entry) => {
              const percent = ((entry.payload.value / total) * 100).toFixed(1);
              return `${value} — ${percent}%`;
            }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default CategoryPieChart;