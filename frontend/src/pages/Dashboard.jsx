import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTransactions, uploadStatement, updateTransaction, deleteTransaction } from '../api/transactions';
import ThemeToggle from '../components/ThemeToggle';
import EditTransactionModal from '../components/EditTransactionModal';
import ConfirmDialog from '../components/ConfirmDialog';
import CategoryPieChart from '../components/CategoryPieChart';
import IncomeVsExpenseChart from '../components/IncomeVsExpenseChart';
import BudgetLimitForm from '../components/BudgetLimitForm';
import BudgetAlerts from '../components/BudgetAlerts';
import SpendingInsights from '../components/SpendingInsights';
import ChargeInsights from '../components/ChargeInsights';
import SavingsGoals from '../components/SavingsGoals';
import FinancialAssistant from '../components/FinancialAssistant';
import LearnedRules from '../components/LearnedRules';
import UploadProgress from '../components/UploadProgress';
import {
  LogOut, Wallet, TrendingUp, TrendingDown, PiggyBank, Sparkles,
  ChevronDown, ChevronUp, Search, Upload, Plus, Lock,
  Pencil, Trash2, Loader2, LayoutDashboard, BarChart3, Lightbulb, Target, ListFilter,
  GraduationCap, Users, UserCheck, Flag
} from 'lucide-react';

/* ---------- helpers ---------- */

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
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

function isErrorMessage(msg) {
  return (
    msg.startsWith('Upload failed') ||
    msg.startsWith('Please') ||
    msg.startsWith('Incorrect') ||
    msg.startsWith('This PDF')
  );
}

const NAV_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} /> },
  { id: 'charts', label: 'Charts', icon: <BarChart3 size={16} /> },
  { id: 'insights', label: 'Insights', icon: <Lightbulb size={16} /> },
  { id: 'budget', label: 'Budget', icon: <Target size={16} /> },
  { id: 'goals', label: 'Goals', icon: <Flag size={16} /> },
  { id: 'transactions', label: 'Transactions', icon: <ListFilter size={16} /> },
  { id: 'upload-section', label: 'Upload', icon: <Upload size={16} /> },
];

const CATEGORY_STYLES = {
  'Food & Dining': 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 dark:border dark:border-orange-500/30',
  'Groceries': 'bg-lime-100 text-lime-700 dark:bg-lime-500/20 dark:text-lime-300 dark:border dark:border-lime-500/30',
  'Transport': 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 dark:border dark:border-sky-500/30',
  'Shopping': 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300 dark:border dark:border-pink-500/30',
  'Bills & Utilities': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border dark:border-indigo-500/30',
  'Entertainment': 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 dark:border dark:border-purple-500/30',
  'Health & Fitness': 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 dark:border dark:border-rose-500/30',
  'Rent/Housing': 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 dark:border dark:border-amber-500/30',
  'Income': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border dark:border-emerald-500/30',
  'Withdrawal': 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  'Other/People': 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300 dark:border dark:border-slate-500/30',
};
const DEFAULT_CATEGORY_STYLE = 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:border dark:border-gray-700';

function Pill({ className, children }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

function CategoryPill({ category }) {
  if (!category) return <span className="text-gray-400">—</span>;
  return <Pill className={CATEGORY_STYLES[category] || DEFAULT_CATEGORY_STYLE}>{category}</Pill>;
}

function TypePill({ type }) {
  const style =
    type === 'INCOME'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border dark:border-emerald-500/30'
      : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 dark:border dark:border-rose-500/30';
  return <Pill className={style}>{type === 'INCOME' ? 'Income' : 'Expense'}</Pill>;
}

function MiniStat({ label, value, icon }) {
  return (
    <div className="bg-bg dark:bg-[#131c2e] rounded-xl px-4 py-3 border border-gray-200/60 dark:border-gray-800/80 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-medium mb-1">
        {icon}
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-base font-bold text-text">{value}</p>
    </div>
  );
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800 ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-12 gap-6">
        <Skeleton className="col-span-12 lg:col-span-7 h-48" />
        <Skeleton className="col-span-12 lg:col-span-5 h-48" />
      </div>
      <div className="grid grid-cols-12 gap-6">
        <Skeleton className="col-span-12 lg:col-span-6 h-72" />
        <Skeleton className="col-span-12 lg:col-span-6 h-72" />
      </div>
      <div className="bg-card rounded-2xl shadow-sm p-6 space-y-3 dark:bg-[#131c2e] dark:border dark:border-gray-800/80">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    </div>
  );
}

/* ---------- Upload Controls ---------- */
function UploadControls({
  idSuffix, centered,
  onFileChange, onUpload, uploadStage, uploadPercent,
  selectedFile, requiresPdfPassword, pdfPassword, onPasswordChange, uploadMessage,
}) {
  const busy = uploadStage !== null;
  const buttonLabel = busy
    ? (uploadStage === 'processing' ? 'Processing...' : 'Uploading...')
    : requiresPdfPassword ? 'Unlock & Upload' : 'Upload Statement';

  return (
    <div className={`flex flex-col items-center justify-center space-y-4 max-w-md mx-auto py-4 transition-all duration-300 ${centered ? 'text-center' : ''}`}>
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-center w-full">
        <input
          type="file"
          accept=".csv,.pdf"
          onChange={onFileChange}
          disabled={busy}
          className="text-sm text-text border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 bg-card dark:bg-[#131c2e] cursor-pointer file:mr-3 file:py-1.5 file:px-3.5 file:rounded-lg file:border-0 file:bg-primary file:text-white file:text-xs file:font-semibold file:cursor-pointer hover:file:opacity-90 transition disabled:opacity-50 w-full sm:w-auto"
        />
        <button
          onClick={onUpload}
          disabled={busy}
          className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-md disabled:opacity-50 whitespace-nowrap"
        >
          {buttonLabel}
        </button>
      </div>

      {requiresPdfPassword && selectedFile?.name?.toLowerCase().endsWith('.pdf') && (
        <div className="w-full transition-all duration-300 animate-fadeIn space-y-1.5">
          <div className="relative flex items-center">
            <Lock className="absolute left-3 text-gray-400" size={16} />
            <input
              id={`pdf-password-${idSuffix}`}
              type="password"
              value={pdfPassword}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="Enter PDF password to unlock"
              autoComplete="current-password"
              disabled={busy}
              className="w-full pl-9 pr-3 py-2.5 border border-primary/40 rounded-xl bg-card dark:bg-[#131c2e] text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary transition shadow-sm disabled:opacity-50"
            />
          </div>
        </div>
      )}

      {uploadStage && (
        <div className="w-full transition-all duration-300">
          <UploadProgress stage={uploadStage} uploadPercent={uploadPercent} />
        </div>
      )}

      {!uploadStage && uploadMessage && (
        <p className={`text-xs font-semibold animate-fadeIn text-center ${isErrorMessage(uploadMessage) ? 'text-danger' : 'text-success'}`}>
          {uploadMessage}
        </p>
      )}
    </div>
  );
}

/* ---------- Main Component ---------- */

function Dashboard() {
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [expandedMonths, setExpandedMonths] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState('All');
  const [activeSection, setActiveSection] = useState('overview');

  const [showHeader, setShowHeader] = useState(true);
  const [headerH, setHeaderH] = useState(0);
  const lastScrollY = useRef(0);
  const wrapperRef = useRef(null);
  const headerRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStage, setUploadStage] = useState(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [requiresPdfPassword, setRequiresPdfPassword] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [refreshingAfterUpload, setRefreshingAfterUpload] = useState(false);

  const [budgetLimitsOpen, setBudgetLimitsOpen] = useState(false);
  const [budgetRefreshKey, setBudgetRefreshKey] = useState(0);

  const [goalsTotalSaved, setGoalsTotalSaved] = useState(0);
  const [username, setUsername] = useState(null);
  const [rulesRefreshKey, setRulesRefreshKey] = useState(0);

  const [editingTransaction, setEditingTransaction] = useState(null);
  const [deletingTransaction, setDeletingTransaction] = useState(null);
  const [deletingMonth, setDeletingMonth] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const hasData = !loading && !error && transactions.length > 0;

  const fetchTransactions = () => {
    setLoading(true);
    setError(null);
    getTransactions()
      .then((data) => setTransactions(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTransactions();
    setUsername(getUsernameFromToken());
  }, []);

  useEffect(() => {
    const measure = () => setHeaderH(headerRef.current?.offsetHeight || 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [username]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (Math.abs(currentScrollY - lastScrollY.current) < 6) return;
      if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
        setShowHeader(false);
      } else {
        setShowHeader(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (loading || transactions.length === 0) return;

    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0,
    };

    const handleIntersect = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, observerOptions);

    NAV_SECTIONS.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [loading, transactions]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleNavClick = (id) => {
    setActiveSection(id);
    if (id === 'upload-section') setUploadOpen(true);
    const element = document.getElementById(id);
    if (element) {
      const offset = (wrapperRef.current?.offsetHeight || 110) + 8;
      const y = element.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const totalIncome = transactions
    .filter((tx) => tx.type === 'INCOME')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const totalExpenses = transactions
    .filter((tx) => tx.type === 'EXPENSE')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : '0.0';
  const freeToSpend = balance - goalsTotalSaved;

  const allMonthsGrouped = groupByMonth(transactions);
  const allMonths = Object.keys(allMonthsGrouped).sort(
    (a, b) => allMonthsGrouped[b].sortDate - allMonthsGrouped[a].sortDate
  );

  const latestMonth = allMonths[0];
  const latestExpenses = latestMonth
    ? allMonthsGrouped[latestMonth].transactions.filter((tx) => tx.type === 'EXPENSE')
    : [];
  const latestSpent = latestExpenses.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const latestByCategory = {};
  latestExpenses.forEach((tx) => {
    const key = tx.category || 'Uncategorized';
    latestByCategory[key] = (latestByCategory[key] || 0) + Number(tx.amount);
  });
  const topCategoryEntry = Object.entries(latestByCategory).sort((a, b) => b[1] - a[1])[0];
  const biggestExpense = latestExpenses.reduce(
    (max, tx) => (!max || Number(tx.amount) > Number(max.amount) ? tx : max),
    null
  );

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
    setTransactions((prev) => prev.map((tx) => (tx.id === id ? { ...tx, ...updated } : tx)));
    setRulesRefreshKey((k) => k + 1);
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
      setDeleteError('Some transactions could not be deleted. Refreshing data...');
      fetchTransactions();
    }
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files?.[0] || null);
    setUploadMessage(null);
    setRequiresPdfPassword(false);
    setPdfPassword('');
  };

  const handlePasswordChange = (value) => {
    setPdfPassword(value);
    setUploadMessage(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadMessage('Please select a file first.');
      return;
    }

    if (requiresPdfPassword && !pdfPassword.trim()) {
      setUploadMessage('Please enter the PDF password.');
      return;
    }

    setUploadMessage(null);
    setUploadStage('uploading');
    setUploadPercent(0);

    try {
      const response = await uploadStatement(
        selectedFile,
        (percent) => {
          setUploadPercent(percent);
          if (percent >= 100) {
            setUploadStage('processing');
          }
        },
        requiresPdfPassword ? pdfPassword : null
      );

      const added = response.data?.transactions?.length ?? 0;
      const skipped = response.data?.skippedDuplicates ?? 0;

      setUploadStage(null);
      setSelectedFile(null);
      setRequiresPdfPassword(false);
      setPdfPassword('');

      if (added === 0) {
        setUploadMessage(`No new transactions. All ${skipped} were already uploaded.`);
        return;
      }

      setUploadMessage(
        skipped > 0
          ? `Added ${added} new transactions. Skipped ${skipped} duplicates.`
          : `Added ${added} transactions.`
      );
      setRefreshingAfterUpload(true);

      const start = Date.now();
      try {
        const data = await getTransactions();
        setTransactions(data);
      } catch {
        setUploadMessage('Statement uploaded successfully, but failed to refresh view. Please reload.');
      } finally {
        const elapsed = Date.now() - start;
        const minDisplay = 1100;
        if (elapsed < minDisplay) {
          await new Promise((resolve) => setTimeout(resolve, minDisplay - elapsed));
        }
        setRefreshingAfterUpload(false);
      }
    } catch (err) {
      setUploadStage(null);
      setRefreshingAfterUpload(false);

      const responseData = err.response?.data;
      const code = responseData?.code;

      if (code === 'PDF_PASSWORD_REQUIRED' || code === 'PDF_PASSWORD_WRONG') {
        setRequiresPdfPassword(true);
        setUploadMessage(
          code === 'PDF_PASSWORD_WRONG'
            ? 'Incorrect PDF password. Please try again.'
            : 'This PDF is password-protected. Enter its password to continue.'
        );
        return;
      }

      const serverMessage =
        typeof responseData === 'string' ? responseData : responseData?.message;

      setUploadMessage(`Upload failed: ${serverMessage || err.message || 'Please try again.'}`);
    }
  };

  const uploadControlProps = {
    onFileChange: handleFileChange,
    onUpload: handleUpload,
    uploadStage,
    uploadPercent,
    selectedFile,
    requiresPdfPassword,
    pdfPassword,
    onPasswordChange: handlePasswordChange,
    uploadMessage,
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f19] text-gray-900 dark:text-gray-100 relative flex flex-col justify-between transition-colors duration-200">
      {refreshingAfterUpload && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white space-y-3">
          <Loader2 size={40} className="animate-spin text-primary" />
          <p className="text-lg font-medium">Parsing statement & refreshing dashboard...</p>
        </div>
      )}

      <div>
        <div
          ref={wrapperRef}
          className="sticky z-30 transition-[top] duration-300 ease-in-out shadow-sm"
          style={{ top: showHeader ? 0 : -headerH }}
        >
          <header
            ref={headerRef}
            className="flex items-center justify-between px-6 sm:px-8 py-3 border-b border-gray-200/80 dark:border-gray-800/80 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Wallet size={22} />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight leading-tight">ArivGo Expense</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">AI-Powered Smart Expense Tracker</p>
              </div>
            </div>

            <div className="flex items-center gap-1 pl-1 pr-1 py-1 rounded-full bg-gray-100 dark:bg-[#1a2333] border border-gray-200 dark:border-gray-800 shadow-sm">
              {username && (
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {username}
                </span>
              )}
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-full hover:bg-white dark:hover:bg-[#253045] transition text-gray-600 dark:text-gray-300 hover:text-danger dark:hover:text-red-400"
                aria-label="Logout"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          </header>

          <nav className="px-6 sm:px-8 py-2 border-b border-gray-200/80 dark:border-gray-800/80 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-md">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar min-w-0 flex-1 py-0.5">
                {hasData && NAV_SECTIONS.map((section) => {
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => handleNavClick(section.id)}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                        isActive
                          ? 'bg-primary text-white shadow-sm font-semibold shadow-primary/20'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#1a2333]'
                      }`}
                    >
                      {section.icon}
                      <span>{section.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex-shrink-0 border-l border-gray-200 dark:border-gray-800 pl-3">
                <ThemeToggle />
              </div>
            </div>
          </nav>
        </div>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          {loading && <DashboardSkeleton />}

          {!loading && error && (
            <p className="text-danger text-center">Error: {error}</p>
          )}

          {!loading && !error && transactions.length === 0 && (
            <section className="bg-white dark:bg-[#131c2e] rounded-2xl shadow-sm border border-gray-200/80 dark:border-gray-800/80 p-10 text-center">
              <Upload size={40} className="mx-auto text-primary mb-4" />
              <h2 className="text-xl font-semibold mb-2">No transactions yet</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Upload a bank statement to get started with your dashboard.
              </p>
              <UploadControls idSuffix="empty" centered {...uploadControlProps} />
            </section>
          )}

          {hasData && (
            <>
              <section id="overview" className="grid grid-cols-12 gap-6 scroll-mt-24">
                <div className="col-span-12 lg:col-span-7 rounded-2xl shadow-md p-6 bg-white dark:bg-[#131c2e] border-2 border-primary/40 dark:border-primary/30 hover:border-primary/60 dark:hover:border-primary/50 transition-all relative overflow-hidden">
                  <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

                  <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
                    <Wallet size={18} />
                    <span>Total Balance</span>
                  </div>

                  <div className="mb-6">
                    <p className="text-4xl font-extrabold tracking-tight">{formatCurrency(balance)}</p>
                    {goalsTotalSaved > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                        <span className="font-semibold text-gray-900 dark:text-gray-200">{formatCurrency(goalsTotalSaved)}</span> set aside for goals
                        {' · '}
                        {freeToSpend >= 0 ? (
                          <>
                            <span className="font-semibold text-primary">{formatCurrency(freeToSpend)}</span> free to spend
                          </>
                        ) : (
                          <span className="font-semibold text-danger">
                            {formatCurrency(Math.abs(freeToSpend))} more than your statements show
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <MiniStat
                      label="Income"
                      value={formatCurrency(totalIncome)}
                      icon={<TrendingUp size={14} className="text-success" />}
                    />
                    <MiniStat
                      label="Expenses"
                      value={formatCurrency(totalExpenses)}
                      icon={<TrendingDown size={14} className="text-danger" />}
                    />
                    <MiniStat
                      label="Savings Rate"
                      value={`${savingsRate}%`}
                      icon={<PiggyBank size={14} className="text-secondary" />}
                    />
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-5 bg-white dark:bg-[#131c2e] rounded-2xl shadow-sm p-6 border border-gray-200/80 dark:border-gray-800/80 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={18} className="text-primary" />
                      <h2 className="text-base font-semibold">Quick Insight</h2>
                    </div>
                    {latestMonth && latestExpenses.length > 0 ? (
                      <div className="space-y-2.5 text-sm">
                        <p className="text-gray-400 dark:text-gray-500 text-xs font-medium uppercase tracking-wider">{latestMonth}</p>
                        <p className="text-gray-700 dark:text-gray-300">
                          You spent <span className="font-semibold text-primary">{formatCurrency(latestSpent)}</span> this month.
                        </p>
                        {topCategoryEntry && (
                          <p className="text-gray-700 dark:text-gray-300 flex items-center gap-1.5 flex-wrap">
                            <span>Top category:</span>
                            <CategoryPill category={topCategoryEntry[0]} />{' '}
                            <span className="font-semibold">({formatCurrency(topCategoryEntry[1])})</span>.
                          </p>
                        )}
                        {biggestExpense && (
                          <p className="text-gray-700 dark:text-gray-300 truncate">
                            Biggest expense:{' '}
                            <span className="font-semibold">{formatCurrency(biggestExpense.amount)}</span>
                            {biggestExpense.merchant ? ` at ${biggestExpense.merchant}` : ''}.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Upload a statement with expenses to see a quick summary here.</p>
                    )}
                  </div>
                </div>
              </section>

              <section id="charts" className="grid grid-cols-12 gap-6 scroll-mt-24">
                <div className="col-span-12 lg:col-span-6 bg-white dark:bg-[#131c2e] rounded-2xl shadow-sm p-6 border border-gray-200/80 dark:border-gray-800/80 flex flex-col">
                  <h2 className="text-base font-semibold mb-4">Income vs Expense</h2>
                  <div className="flex-1 flex items-center justify-center">
                    <div className="w-full">
                      <IncomeVsExpenseChart transactions={transactions} />
                    </div>
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-6 bg-white dark:bg-[#131c2e] rounded-2xl shadow-sm p-6 border border-gray-200/80 dark:border-gray-800/80">
                  <CategoryPieChart transactions={transactions} />
                </div>
              </section>

              <section id="insights" className="bg-card rounded-2xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 scroll-mt-24">
                <SpendingInsights transactions={transactions} />
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <ChargeInsights refreshKey={transactions.length} />
                </div>
              </section>

              <section id="budget" className="bg-white dark:bg-[#131c2e] rounded-2xl shadow-sm p-6 border border-gray-200/80 dark:border-gray-800/80 space-y-4 scroll-mt-24">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Budget Limits</h2>
                  <button
                    onClick={() => setBudgetLimitsOpen(!budgetLimitsOpen)}
                    className="flex items-center gap-1 text-sm bg-primary text-white px-3.5 py-1.5 rounded-lg hover:opacity-90 transition font-semibold shadow-sm"
                  >
                    <Plus size={16} /> {budgetLimitsOpen ? 'Cancel' : 'Add/Edit Limits'}
                  </button>
                </div>
                {budgetLimitsOpen && (
                  <BudgetLimitForm onLimitSet={() => { setBudgetRefreshKey((k) => k + 1); }} />
                )}
                <BudgetAlerts transactions={transactions} refreshKey={budgetRefreshKey} />
              </section>

              <section id="goals" className="bg-white dark:bg-[#131c2e] rounded-2xl shadow-sm p-6 border border-gray-200/80 dark:border-gray-800/80 scroll-mt-24">
                <SavingsGoals
                  refreshKey={transactions.length}
                  onTotalSavedChange={setGoalsTotalSaved}
                />
              </section>

              <section id="transactions" className="bg-white dark:bg-[#131c2e] rounded-2xl shadow-sm p-6 border border-gray-200/80 dark:border-gray-800/80 scroll-mt-24">
                <h2 className="text-lg font-semibold mb-4">Transactions</h2>
                <div className="flex flex-col sm:flex-row gap-3 mb-4 sm:justify-between">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search merchant or description"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a2333] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary transition text-sm shadow-sm"
                    />
                  </div>
                  <select
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-[#1a2333] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary transition text-sm shadow-sm"
                  >
                    <option value="All">All Months</option>
                    {allMonths.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {displayedMonths.length === 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm py-4">No transactions found.</p>
                )}

                {displayedMonths.map((month) => {
                  const isExpanded = expandedMonths[month];
                  const monthTransactions = grouped[month].transactions;
                  return (
                    <div key={month} className="border-b border-gray-100 dark:border-gray-800 py-3 last:border-b-0">
                      <div className="flex items-center justify-between">
                        <div
                          className="flex items-center gap-2 cursor-pointer flex-1 py-1"
                          onClick={() => toggleMonth(month)}
                        >
                          <span className="font-semibold">
                            {month} ({monthTransactions.length})
                          </span>
                          <ChevronDown
                            size={18}
                            className={`text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-primary' : ''}`}
                          />
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletingMonth(month); setDeleteError(null); }}
                          aria-label={`Delete all transactions in ${month}`}
                          title="Delete entire month"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-danger dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-[#1a2333] transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="overflow-x-auto mt-3">
                          <table className="w-full text-sm text-left">
                            <thead>
                              <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-800 text-xs uppercase tracking-wider">
                                <th className="py-2.5 font-medium">Date</th>
                                <th className="font-medium">Merchant</th>
                                <th className="font-medium">Description</th>
                                <th className="font-medium">Category</th>
                                <th className="font-medium">Type</th>
                                <th className="font-medium text-right">Amount</th>
                                <th className="font-medium text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                              {monthTransactions.map((tx) => (
                                <tr
                                  key={tx.id}
                                  className="hover:bg-gray-50/80 dark:hover:bg-[#1a2333]/50 transition"
                                >
                                  <td className="py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{tx.transactionDate}</td>
                                  <td className="font-medium">{tx.merchant}</td>
                                  <td className="text-gray-500 dark:text-gray-400 max-w-xs truncate" title={tx.description}>{tx.description}</td>
                                  <td><CategoryPill category={tx.category} /></td>
                                  <td><TypePill type={tx.type} /></td>
                                  <td className={`text-right font-semibold whitespace-nowrap ${tx.type === 'INCOME' ? 'text-success' : 'text-danger'}`}>
                                    {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                                  </td>
                                  <td className="text-right">
                                    <div className="flex justify-end gap-1">
                                      <button
                                        onClick={() => setEditingTransaction(tx)}
                                        aria-label="Edit transaction"
                                        title="Edit"
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-[#1a2333] transition"
                                      >
                                        <Pencil size={16} />
                                      </button>
                                      <button
                                        onClick={() => { setDeletingTransaction(tx); setDeleteError(null); }}
                                        aria-label="Delete transaction"
                                        title="Delete"
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-danger dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-[#1a2333] transition"
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

              <LearnedRules refreshKey={rulesRefreshKey} />

              <section id="upload-section" className="bg-white dark:bg-[#131c2e] rounded-2xl shadow-sm p-6 border border-gray-200/80 dark:border-gray-800/80 scroll-mt-24">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setUploadOpen(!uploadOpen)}
                >
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Upload size={18} /> Upload Statement
                  </h2>
                  <ChevronDown
                    size={18}
                    className={`text-gray-400 transition-transform duration-300 ${uploadOpen ? 'rotate-180 text-primary' : ''}`}
                  />
                </div>

                {uploadOpen && (
                  <div className="mt-4">
                    <UploadControls idSuffix="main" {...uploadControlProps} />
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>

      <footer className="mt-12 border-t border-gray-200 dark:border-gray-800/80 bg-white dark:bg-[#111827] py-6 px-6 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <GraduationCap size={18} className="text-primary" />
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-200">B.Tech Minor Project — Semester 5</p>
              <p>Chinmaya Vishwa Vidyapeeth (CVV)</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-center md:text-left">
            <Users size={16} className="text-primary" />
            <p>
              <span className="font-medium text-gray-900 dark:text-gray-200">Team:</span> Akhilesh A • Gokul Sajith • Vishnu Vijay
            </p>
          </div>

          <div className="flex items-center gap-2">
            <UserCheck size={16} className="text-primary" />
            <p>
              <span className="font-medium text-gray-900 dark:text-gray-200">Guide:</span> Ms. Kripa Radhakrishnan
            </p>
          </div>
        </div>
      </footer>

      {/* Floating AI Assistant Widget */}
      <FinancialAssistant />

      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          onSave={handleSaveEdit}
          onClose={() => setEditingTransaction(null)}
        />
      )}

      {deletingTransaction && (
        <ConfirmDialog
          title="Delete Transaction"
          message={`Are you sure you want to delete the transaction "${deletingTransaction.description || deletingTransaction.merchant}"?`}
          error={deleteError}
          onConfirm={handleConfirmDelete}
          onCancel={() => { setDeletingTransaction(null); setDeleteError(null); }}
        />
      )}

      {deletingMonth && (
        <ConfirmDialog
          title="Delete Entire Month"
          message={`Are you sure you want to delete all transactions for ${deletingMonth}? This action cannot be undone.`}
          error={deleteError}
          onConfirm={handleConfirmDeleteMonth}
          onCancel={() => { setDeletingMonth(null); setDeleteError(null); }}
        />
      )}
    </div>
  );
}

export default Dashboard;