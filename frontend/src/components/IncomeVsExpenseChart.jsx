import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const AXIS_COLOR = '#9ca3af'; // readable on both light and dark cards
const LINE_COLOR = '#6b7280';

function formatINR(value) {
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Groups transactions into one { month, Income, Expense } row per calendar month
function buildMonthlyData(transactions) {
  const byMonth = {};

  transactions.forEach((tx) => {
    const [year, month] = String(tx.transactionDate).split('-');
    const y = Number(year);
    const m = Number(month) - 1;
    if (Number.isNaN(y) || Number.isNaN(m)) return;

    const key = y * 12 + m;
    if (!byMonth[key]) {
      byMonth[key] = {
        sortKey: key,
        month: `${MONTHS[m]} ${String(y).slice(-2)}`,
        Income: 0,
        Expense: 0,
      };
    }

    if (tx.type === 'INCOME') byMonth[key].Income += Number(tx.amount);
    if (tx.type === 'EXPENSE') byMonth[key].Expense += Number(tx.amount);
  });

  return Object.values(byMonth).sort((a, b) => a.sortKey - b.sortKey);
}

function IncomeVsExpenseChart({ transactions }) {
  const data = buildMonthlyData(transactions);

  if (data.length === 0) {
    return <p className="text-sm text-gray-400 text-center">No data to show yet.</p>;
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }} barGap={4}>
          <XAxis
            dataKey="month"
            tick={{ fill: AXIS_COLOR, fontSize: 13 }}
            axisLine={{ stroke: LINE_COLOR }}
            tickLine={{ stroke: LINE_COLOR }}
          />
          <YAxis
            tick={{ fill: AXIS_COLOR, fontSize: 13 }}
            axisLine={{ stroke: LINE_COLOR }}
            tickLine={{ stroke: LINE_COLOR }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(148, 163, 184, 0.15)' }}
            formatter={(value, name) => [formatINR(value), name]}
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
            }}
            labelStyle={{ color: '#111827', fontWeight: 600 }}
          />
          <Legend />
          <Bar dataKey="Income" fill="#4caf50" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Expense" fill="#f44336" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default IncomeVsExpenseChart;