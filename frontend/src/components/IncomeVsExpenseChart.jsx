import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Groups transactions by month, summing income and expense separately
function getIncomeVsExpense(transactions) {
  const totals = {}; // e.g. { "2026-01": { income: 5000, expense: 4500 } }

  transactions.forEach((t) => {
    const date = new Date(t.transactionDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!totals[key]) {
      totals[key] = { income: 0, expense: 0 };
    }

    if (t.type === 'INCOME') {
      totals[key].income += Number(t.amount);
    } else if (t.type === 'EXPENSE') {
      totals[key].expense += Number(t.amount);
    }
  });

  return Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => {
      const [year, month] = key.split('-');
      const label = new Date(year, month - 1).toLocaleString('default', {
        month: 'short',
        year: '2-digit',
      });
      return { month: label, income: values.income, expense: values.expense };
    });
}

function IncomeVsExpenseChart({ transactions }) {
  const data = getIncomeVsExpense(transactions);

  if (data.length === 0) {
    return <p>No data to show yet.</p>;
  }

  return (
    <div style={{ width: '100%', height: 300 }}>
      <h3>Income vs Expense</h3>
      <ResponsiveContainer>
        <BarChart data={data}>
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="income" fill="#4caf50" name="Income" />
          <Bar dataKey="expense" fill="#f44336" name="Expense" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default IncomeVsExpenseChart;