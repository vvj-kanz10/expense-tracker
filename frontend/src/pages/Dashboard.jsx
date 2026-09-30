import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTransactions, uploadStatement, updateTransaction, deleteTransaction } from '../api/transactions';
import ThemeToggle from '../components/ThemeToggle';
import EditTransactionModal from '../components/EditTransactionModal';
import ConfirmDialog from '../components/ConfirmDialog';
import CategoryPieChart from '../components/CategoryPieChart';
import MonthlyTrendChart from '../components/MonthlyTrendChart';
import IncomeVsExpenseChart from '../components/IncomeVsExpenseChart';
import BudgetLimitForm from '../components/BudgetLimitForm';
import BudgetAlerts from '../components/BudgetAlerts';
import SpendingInsights from '../components/SpendingInsights';
import UploadProgress from '../components/UploadProgress';
import {
  LogOut, Wallet, TrendingUp, TrendingDown, PiggyBank,
  ChevronDown, ChevronRight, Search, Upload, Plus, Menu, X,
  Pencil, Trash2, Loader2,
} from 'lucide-react';

function groupByMonth(transactions) {
  const groups = {};
  transactions.forEach((tx) => {
    const date = new Date(tx.transactionDate);
    const monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!groups[monthKey]) {
      groups[monthKey] = { transactions: [], sortDate: new Date(date.getFullYear(), date.getMonth(), 1) };
    }
    groups[monthKey].transactions.push(tx);
  });
  return groups;
}

function formatCurrency(amount) {
  return `₹${Number(amount).toFixed(2)}`;
}

// Decodes the username straight out of the JWT payload — no extra
// dependency or backend call needed, since the token is already
// sitting in localStorage.
function getUsernameFromToken() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || payload.username || null;
  } catch {
    return null;
  }
}

const NAV_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'charts', label: 'Charts' },
  { id: 'insights', label: 'Insights' },
  { id: 'budget', label: 'Budget' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'upload-section', label: 'Upload' },
];

function SummaryCard({ label, value, icon, valueClass }) {
  return (
    <div className="bg-card rounded-xl shadow p-5 flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-400 mb-1">{label}</p>
        <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      </div>
      <div className="p-3 rounded-full bg-primary/10 text-primary">{icon}</div>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [expandedMonths, setExpandedMonths] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState('All');

  const [selectedFile, setSelectedFile] = useState(null);
  // uploadStage: null | 'uploading' | 'processing'
  const [uploadStage, setUploadStage] = useState(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [refreshingAfterUpload, setRefreshingAfterUpload] = useState(false);

  const [budgetLimitsOpen, setBudgetLimitsOpen] = useState(false);
  const [budgetRefreshKey, setBudgetRefreshKey] = useState(0);

  const [monthlyChartOpen, setMonthlyChartOpen] = useState(false);
  const [categoryChartOpen, setCategoryChartOpen] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [username, setUsername] = useState(null);

  const [editingTransaction, setEditingTransaction] = useState(null);
  const [deletingTransaction, setDeletingTransaction] = useState(null);
  const [deletingMonth, setDeletingMonth] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const fetchTransactions = () => {
    setLoading(true);
    getTransactions()
      .then((data) => setTransactions(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTransactions();
    setUsername(getUsernameFromToken());
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleNavClick = (id) => {
    setMenuOpen(false);
    // Give the dropdown a tick to close before scrolling, so the
    // layout shift doesn't throw off scrollIntoView's target position.
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }, 0);
  };

  // Summary calculations
  const totalIncome = transactions
    .filter((tx) => tx.type === 'INCOME')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const totalExpenses = transactions
    .filter((tx) => tx.type === 'EXPENSE')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : '0.0';

  // Month list for the filter dropdown (always built from all transactions, unaffected by search)
  const allMonthsGrouped = groupByMonth(transactions);
  const allMonths = Object.keys(allMonthsGrouped).sort(
    (a, b) => allMonthsGrouped[b].sortDate - allMonthsGrouped[a].sortDate
  );

  // Search filter, then group, then apply month filter
  const searchedTransactions = transactions.filter((tx) => {
    const term = searchTerm.toLowerCase();
    return (
      tx.merchant?.toLowerCase().includes(term) ||
      tx.description?.toLowerCase().includes(term)
    );
  });
  const grouped = groupByMonth(searchedTransactions);
  const sortedMonths = Object.keys(grouped).sort(
    (a, b) => grouped[b].sortDate - grouped[a].sortDate
  );
  const displayedMonths = monthFilter === 'All' ? sortedMonths : sortedMonths.filter((m) => m === monthFilter);

  const toggleMonth = (month) => {
    setExpandedMonths((prev) => ({ ...prev, [month]: !prev[month] }));
  };

  const handleSaveEdit = async (id, updates) => {
    // The backend's TransactionRequest DTO requires transactionDate,
    // type, and amount on every PUT — sending only the two edited
    // fields fails validation. Pull the rest from the transaction as
    // it currently stands in state.
    const original = transactions.find((tx) => tx.id === id);
    const payload = {
      transactionDate: original.transactionDate,
      type: original.type,
      amount: original.amount,
      description: original.description,
      merchant: updates.merchant,
      category: updates.category,
    };
    const updated = await updateTransaction(id, payload);
    // Merge the server's response back into local state rather than
    // refetching everything, so the table updates instantly.
    setTransactions((prev) => prev.map((tx) => (tx.id === id ? { ...tx, ...updated } : tx)));
  };

  const handleConfirmDelete = async () => {
    if (!deletingTransaction) return;
    try {
      await deleteTransaction(deletingTransaction.id);
      setTransactions((prev) => prev.filter((tx) => tx.id !== deletingTransaction.id));
      setDeletingTransaction(null);
      setDeleteError(null);
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete transaction.');
    }
  };

  const handleConfirmDeleteMonth = async () => {
    if (!deletingMonth) return;
    const monthTx = groupByMonth(transactions)[deletingMonth]?.transactions || [];
    const idsToDelete = monthTx.map((tx) => tx.id);
    try {
      await Promise.all(idsToDelete.map((id) => deleteTransaction(id)));
      setTransactions((prev) => prev.filter((tx) => !idsToDelete.includes(tx.id)));
      setDeletingMonth(null);
      setDeleteError(null);
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete some transactions in that month.');
    }
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setUploadMessage(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadMessage('Please select a file first.');
      return;
    }
    setUploadMessage(null);
    setUploadStage('uploading');
    setUploadPercent(0);

    try {
      await uploadStatement(selectedFile, (percent) => {
        setUploadPercent(percent);
        // Once the bytes are fully sent, we're waiting on the server
        // to parse + categorize — switch to the indeterminate stage.
        if (percent >= 100) {
          setUploadStage('processing');
        }
      });

      setUploadStage(null);
      setUploadMessage('Upload successful!');
      setSelectedFile(null);
      setRefreshingAfterUpload(true);

      const start = Date.now();
      const data = await getTransactions();
      // Keep the overlay up for at least ~1.1s even if the fetch is instant —
      // otherwise it just flashes and looks like a glitch rather than a
      // deliberate step.
      const elapsed = Date.now() - start;
      const minDisplay = 1100;
      if (elapsed < minDisplay) {
        await new Promise((resolve) => setTimeout(resolve, minDisplay - elapsed));
      }
      setTransactions(data);
      setRefreshingAfterUpload(false);
    } catch (err) {
      setUploadMessage(`Upload failed: ${err.message}`);
      setUploadStage(null);
      setRefreshingAfterUpload(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Header */}
      <header className="relative flex items-center justify-between px-6 sm:px-8 py-4 border-b border-gray-200 dark:border-gray-700 bg-card">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-full bg-card border border-gray-200 dark:border-gray-700 hover:opacity-80 transition"
            aria-label="Toggle navigation menu"
            title="Menu"
          >
            {menuOpen ? <X size={20} className="text-primary" /> : <Menu size={20} className="text-primary" />}
          </button>
          <h1 className="text-xl font-bold text-text">ExpenseTracker</h1>

          {menuOpen && (
            <div className="absolute top-full left-6 sm:left-8 mt-2 w-48 bg-card border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-2 z-20">
              {NAV_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => handleNavClick(section.id)}
                  className="w-full text-left px-4 py-2 text-sm text-text hover:bg-bg transition"
                >
                  {section.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setUploadOpen(true);
              document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="p-2 rounded-full bg-card border border-gray-200 dark:border-gray-700 hover:opacity-80 transition"
            aria-label="Upload statement"
            title="Upload statement"
          >
            <Upload size={20} className="text-primary" />
          </button>
          <ThemeToggle />

          {/* Outer oval: username (inner oval, subtle tint) + logout icon, grouped together */}
          <div className="flex items-center gap-1 pl-1 pr-1 py-1 rounded-full bg-card border border-gray-200 dark:border-gray-700">
            {username && (
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                {username}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="p-2 rounded-full hover:bg-bg transition"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut size={18} className="text-text hover:text-danger transition" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {loading && (
          <p className="text-gray-400 text-center">Loading your dashboard...</p>
        )}

        {!loading && error && (
          <p className="text-danger text-center">Error: {error}</p>
        )}

        {!loading && !error && transactions.length === 0 && (
          /* Empty state — new user with no transactions yet.
             Nothing else (summary cards, charts, insights, budget, table)
             is worth showing with zero data, so we skip straight to Upload. */
          <section className="bg-card rounded-xl shadow p-10 text-center">
            <Upload size={40} className="mx-auto text-primary mb-4" />
            <h2 className="text-xl font-semibold text-text mb-2">No transactions yet</h2>
            <p className="text-gray-400 mb-6">
              Upload a bank statement to get started with your dashboard.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
              <input
                type="file"
                accept=".csv,.pdf"
                onChange={handleFileChange}
                disabled={uploadStage !== null}
                className="text-sm text-text border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-card cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-white file:cursor-pointer hover:file:opacity-90 transition disabled:opacity-50"
              />
              <button
                onClick={handleUpload}
                disabled={uploadStage !== null}
                className="bg-primary text-white px-5 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
              >
                {uploadStage ? 'Uploading...' : 'Upload Statement'}
              </button>
            </div>
            {uploadStage && (
              <div className="mt-4">
                <UploadProgress stage={uploadStage} uploadPercent={uploadPercent} />
              </div>
            )}
            {!uploadStage && uploadMessage && (
              <p className={`mt-3 text-sm ${uploadMessage.startsWith('Upload failed') || uploadMessage.startsWith('Please') ? 'text-danger' : 'text-success'}`}>
                {uploadMessage}
              </p>
            )}
          </section>
        )}

        {!loading && !error && transactions.length > 0 && (
          <>
            {/* Overview: title, then Income vs Expense for context, then the stat cards */}
            <section id="overview" className="space-y-6">
              <h2 className="text-lg font-semibold text-text">Overview</h2>

              <div className="bg-card rounded-xl shadow p-6">
                <IncomeVsExpenseChart transactions={transactions} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard
                  label="Total Balance"
                  value={formatCurrency(balance)}
                  icon={<Wallet size={22} />}
                  valueClass={balance >= 0 ? 'text-primary' : 'text-danger'}
                />
                <SummaryCard
                  label="Income"
                  value={formatCurrency(totalIncome)}
                  icon={<TrendingUp size={22} />}
                  valueClass="text-success"
                />
                <SummaryCard
                  label="Expenses"
                  value={formatCurrency(totalExpenses)}
                  icon={<TrendingDown size={22} />}
                  valueClass="text-danger"
                />
                <SummaryCard
                  label="Savings Rate"
                  value={`${savingsRate}%`}
                  icon={<PiggyBank size={22} />}
                  valueClass="text-secondary"
                />
              </div>
            </section>

            {/* Charts — stacked full-width so each one stays easy to read on its own */}
            <div id="charts" className="space-y-6">
              <h2 className="text-lg font-semibold text-text">Analytics</h2>

              <div className="bg-card rounded-xl shadow p-6">
                <div
                  className="flex items-center justify-between cursor-pointer mb-4"
                  onClick={() => setMonthlyChartOpen(!monthlyChartOpen)}
                >
                  <h3 className="text-base font-semibold text-text">Monthly Spending</h3>
                  {monthlyChartOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
                {monthlyChartOpen && <MonthlyTrendChart transactions={transactions} />}
              </div>

              <div className="bg-card rounded-xl shadow p-6">
                <div
                  className="flex items-center justify-between cursor-pointer mb-4"
                  onClick={() => setCategoryChartOpen(!categoryChartOpen)}
                >
                  <h3 className="text-base font-semibold text-text">Spending by Category</h3>
                  {categoryChartOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
                {categoryChartOpen && <CategoryPieChart transactions={transactions} />}
              </div>
            </div>

            {/* AI Savings + Spending Insights */}
            <section id="insights" className="bg-card rounded-xl shadow p-6">
              <SpendingInsights transactions={transactions} />
            </section>

            {/* Budget */}
            <section id="budget" className="bg-card rounded-xl shadow p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text">Budget Limits</h2>
                <button
                  onClick={() => setBudgetLimitsOpen(!budgetLimitsOpen)}
                  className="flex items-center gap-1 text-sm bg-primary text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition"
                >
                  <Plus size={16} /> {budgetLimitsOpen ? 'Cancel' : 'Add Limit'}
                </button>
              </div>
              {budgetLimitsOpen && (
                <BudgetLimitForm onLimitSet={() => { setBudgetRefreshKey((k) => k + 1); setBudgetLimitsOpen(false); }} />
              )}
              <BudgetAlerts transactions={transactions} refreshKey={budgetRefreshKey} />
            </section>

            {/* Transactions table */}
            <section id="transactions" className="bg-card rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold text-text mb-4">Transactions</h2>
              <div className="flex flex-col sm:flex-row gap-3 mb-4 sm:justify-between">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search merchant or description"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-card text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
                  />
                </div>
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-card text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
                >
                  <option value="All">All Months</option>
                  {allMonths.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {displayedMonths.length === 0 && (
                <p className="text-gray-400">No transactions found.</p>
              )}

              {displayedMonths.map((month) => {
                const isExpanded = expandedMonths[month];
                const monthTransactions = grouped[month].transactions;
                return (
                  <div key={month} className="border-b border-gray-200 dark:border-gray-700 py-3 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <div
                        className="flex items-center gap-2 cursor-pointer flex-1"
                        onClick={() => toggleMonth(month)}
                      >
                        <span className="font-medium text-text">
                          {month} ({monthTransactions.length})
                        </span>
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeletingMonth(month); setDeleteError(null); }}
                        aria-label={`Delete all transactions in ${month}`}
                        title="Delete entire month"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-danger hover:bg-bg transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="overflow-x-auto mt-3">
                        <table className="w-full text-sm text-left">
                          <thead>
                            <tr className="text-gray-400 border-b border-gray-200 dark:border-gray-700">
                              <th className="py-2 font-medium">Date</th>
                              <th className="font-medium">Merchant</th>
                              <th className="font-medium">Description</th>
                              <th className="font-medium">Category</th>
                              <th className="font-medium">Type</th>
                              <th className="font-medium text-right">Amount</th>
                              <th className="font-medium text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthTransactions.map((tx) => (
                              <tr
                                key={tx.id}
                                className="border-b border-gray-100 dark:border-gray-800 hover:bg-bg transition"
                              >
                                <td className="py-2 text-text">{tx.transactionDate}</td>
                                <td className="text-text">{tx.merchant}</td>
                                <td className="text-text">{tx.description}</td>
                                <td className="text-text">{tx.category}</td>
                                <td className={tx.type === 'INCOME' ? 'text-success' : 'text-danger'}>
                                  {tx.type}
                                </td>
                                <td className={`text-right ${tx.type === 'INCOME' ? 'text-success' : 'text-danger'}`}>
                                  {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                                </td>
                                <td className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => setEditingTransaction(tx)}
                                      aria-label="Edit transaction"
                                      title="Edit"
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-bg transition"
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button
                                      onClick={() => { setDeletingTransaction(tx); setDeleteError(null); }}
                                      aria-label="Delete transaction"
                                      title="Delete"
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-danger hover:bg-bg transition"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            {/* Upload Statement */}
            <section id="upload-section" className="bg-card rounded-xl shadow p-6">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setUploadOpen(!uploadOpen)}
              >
                <h2 className="text-lg font-semibold flex items-center gap-2 text-text">
                  <Upload size={18} /> Upload Statement
                </h2>
                {uploadOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </div>

              {uploadOpen && (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <input
                      type="file"
                      accept=".csv,.pdf"
                      onChange={handleFileChange}
                      disabled={uploadStage !== null}
                      className="text-sm text-text border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-card cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-white file:cursor-pointer hover:file:opacity-90 transition disabled:opacity-50"
                    />
                    <button
                      onClick={handleUpload}
                      disabled={uploadStage !== null}
                      className="bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                    >
                      {uploadStage ? 'Uploading...' : 'Upload'}
                    </button>
                    {!uploadStage && uploadMessage && (
                      <p className={uploadMessage.startsWith('Upload failed') || uploadMessage.startsWith('Please') ? 'text-danger text-sm' : 'text-success text-sm'}>
                        {uploadMessage}
                      </p>
                    )}
                  </div>
                  {uploadStage && (
                    <UploadProgress stage={uploadStage} uploadPercent={uploadPercent} />
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-700 bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-center space-y-2">
          <p className="text-sm font-medium text-text">
            ExpenseTracker — created by Akhilesh, Gokul and Vishnu
          </p>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Your data stays yours. Transactions and statements are tied only to your account —
            nobody else can view, share, or sell them.
          </p>
        </div>
      </footer>

      {refreshingAfterUpload && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-card rounded-xl shadow-lg p-8 text-center max-w-xs w-full">
            <Loader2 size={36} className="mx-auto text-primary animate-spin mb-4" />
            <h3 className="text-base font-semibold text-text mb-1">Updating your dashboard</h3>
            <p className="text-sm text-gray-400">
              Just a moment while we bring in your new transactions. Thanks for your patience!
            </p>
          </div>
        </div>
      )}

      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={handleSaveEdit}
        />
      )}

      {deletingTransaction && (
        <ConfirmDialog
          title="Delete transaction?"
          message={`This will permanently delete "${deletingTransaction.description}". This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingTransaction(null)}
        />
      )}
      {deletingMonth && (
        <ConfirmDialog
          title={`Delete all transactions in ${deletingMonth}?`}
          message={`This will permanently delete all ${(groupByMonth(transactions)[deletingMonth]?.transactions || []).length} transactions from ${deletingMonth}. This can't be undone.`}
          confirmLabel="Delete month"
          onConfirm={handleConfirmDeleteMonth}
          onCancel={() => setDeletingMonth(null)}
        />
      )}
      {deleteError && (
        <p className="fixed bottom-4 right-4 bg-danger text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {deleteError}
        </p>
      )}
    </div>
  );
}

export default Dashboard;