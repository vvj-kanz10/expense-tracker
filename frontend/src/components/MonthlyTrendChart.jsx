import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

// Groups transactions by month and calculates Net Savings (Income - Expense)
function getNetCashflowData(transactions) {
  const monthMap = {};

  transactions.forEach((t) => {
    const date = new Date(t.transactionDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthMap[key]) {
      monthMap[key] = { income: 0, expense: 0, sortKey: key };
    }

    if (t.type === 'INCOME') {
      monthMap[key].income += Number(t.amount);
    } else if (t.type === 'EXPENSE') {
      monthMap[key].expense += Number(t.amount);
    }
  });

  return Object.values(monthMap)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((item) => {
      const [year, month] = item.sortKey.split('-');
      const label = new Date(year, month - 1).toLocaleString('default', {
        month: 'short',
        year: '2-digit',
      });
      const net = item.income - item.expense;
      return { month: label, net, isPositive: net >= 0 };
    });
}

function MonthlyTrendChart({ transactions }) {
  const data = getNetCashflowData(transactions);

  if (data.length === 0) {
    return <p className="text-gray-400 text-sm py-8 text-center">No transaction data to show yet.</p>;
  }

  return (
    <div className="w-full h-72">
      <div className="mb-2">
        <p className="text-xs text-gray-400">Net Cashflow (Income vs Expenses per month)</p>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="month"
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `₹${val}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card, #1e293b)',
              borderColor: 'rgba(156, 163, 175, 0.2)',
              borderRadius: '0.75rem',
              color: 'var(--text, #f8fafc)',
            }}
            formatter={(value) => [
              `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
              'Net Savings',
            ]}
          />
          <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
          <Bar dataKey="net" radius={[6, 6, 6, 6]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isPositive ? '#10b981' : '#f43f5e'} // Emerald green for saved, Rose red for deficit
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default MonthlyTrendChart;