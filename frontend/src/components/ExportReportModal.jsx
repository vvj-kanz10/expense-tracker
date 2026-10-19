import { useState, useEffect } from 'react';
import { X, FileDown } from 'lucide-react';
import { summarizeMonth, generateMonthlyReport } from '../utils/exportReport';

function formatCurrency(amount) {
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ExportReportModal({ months, transactions, effectiveTransactions, username, onClose }) {
  const [month, setMonth] = useState(months[0]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { rows, income, expenses } = summarizeMonth(month, transactions);

  const handleDownload = () => {
    setError(null);
    try {
      generateMonthlyReport({ monthKey: month, transactions, effectiveTransactions, username });
      onClose();
    } catch (err) {
      console.error(err);
      setError('Could not create the report. Please try again.');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm bg-white dark:bg-[#131c2e] rounded-2xl shadow-xl border border-gray-200/80 dark:border-gray-800/80 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileDown size={20} className="text-primary" /> Download report
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#1a2333] transition"
          >
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 bg-white dark:bg-[#1a2333] text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition shadow-sm"
          >
            {months.map((m) => (
              <option key={m} value={m} className="bg-card text-text">{m}</option>
            ))}
          </select>
        </div>

        <div className="rounded-xl bg-gray-50 dark:bg-[#1a2333] px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Transactions</span>
            <span className="font-semibold">{rows.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Income</span>
            <span className="font-semibold text-success">{formatCurrency(income)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Expenses</span>
            <span className="font-semibold text-danger">{formatCurrency(expenses)}</span>
          </div>
        </div>

        {error && <p className="text-xs font-semibold text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a2333] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 bg-primary text-white px-5 py-2 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-md"
          >
            <FileDown size={16} /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportReportModal;