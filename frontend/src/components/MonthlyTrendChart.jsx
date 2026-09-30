import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Groups transactions by month and sums up EXPENSE amounts only
function getMonthlyTotals(transactions) {
  const totals = {}; // e.g. { "2026-01": 4500, "2026-02": 3200 }

  transactions.forEach((t) => {
    if (t.type !== 'EXPENSE') return; // skip income, we only want spending

    const date = new Date(t.transactionDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    totals[key] = (totals[key] || 0) + Number(t.amount);
  });

  // Convert to array, sorted oldest -> newest
  return Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, total]) => {
      const [year, month] = key.split('-');
      const label = new Date(year, month - 1).toLocaleString('default', {
        month: 'short',
        year: '2-digit',
      });
      return { month: label, total };
    });
}

function MonthlyTrendChart({ transactions }) {
  const data = getMonthlyTotals(transactions);

  if (data.length === 0) {
    return <p>No data to show yet.</p>;
  }

  return (
    <div style={{ width: '100%', height: 300 }}>
      <h3>Monthly Spending Trend</h3>
      <ResponsiveContainer>
        <BarChart data={data}>
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="total" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default MonthlyTrendChart;