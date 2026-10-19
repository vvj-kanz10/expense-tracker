import { useState, useEffect } from 'react';
import { Link2, Loader2 } from 'lucide-react';

function formatCurrency(amount) {
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Side({ label, tx, tone }) {
  return (
    <div className={`flex-1 min-w-0 rounded-xl p-3 border ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-semibold truncate" title={tx.description}>{tx.description}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
        {tx.merchant && tx.merchant !== 'Unknown' ? `${tx.merchant} · ` : ''}{tx.category}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{tx.transactionDate}</p>
    </div>
  );
}

// matches: [{ manual, statement }]
// onResolve(manualIdsToDelete): deletes those manual entries; rejects with an Error if some fail
// onClose: keep everything as it is
function DuplicateMatchDialog({ matches, onResolve, onClose }) {
  const [checked, setChecked] = useState(() => {
    const initial = {};
    matches.forEach((m) => { initial[m.manual.id] = true; });
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  const selectedIds = matches
    .filter((m) => checked[m.manual.id] !== false)
    .map((m) => m.manual.id);

  const toggle = (id) => setChecked((prev) => ({ ...prev, [id]: prev[id] === false }));

  const handleMerge = async () => {
    setSaving(true);
    setError(null);
    try {
      await onResolve(selectedIds);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col bg-white dark:bg-[#131c2e] rounded-2xl shadow-xl border border-gray-200/80 dark:border-gray-800/80">
        <div className="p-6 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Link2 size={20} className="text-primary" />
            <h2 className="text-lg font-semibold">Is this the same payment?</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {matches.length === 1 ? 'An entry you added by hand looks like a row' : 'Some entries you added by hand look like rows'} from
            the statement you just uploaded. Tick the ones that are the same payment, and your manual entry
            will be removed so it is not counted twice.
          </p>
        </div>

        <div className="px-6 py-2 overflow-y-auto space-y-3">
          {matches.map((m) => {
            const isChecked = checked[m.manual.id] !== false;
            return (
              <div
                key={m.manual.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-800 p-3 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{formatCurrency(m.statement.amount)}</span>
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={saving}
                      onChange={() => toggle(m.manual.id)}
                      className="h-4 w-4 accent-emerald-500 cursor-pointer"
                    />
                    Same payment
                  </label>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Side
                    label="You added"
                    tx={m.manual}
                    tone="border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10"
                  />
                  <Side
                    label="On the statement"
                    tx={m.statement}
                    tone="border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 pt-3 space-y-3">
          {error && <p className="text-xs font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a2333] transition disabled:opacity-50"
            >
              Keep all
            </button>
            <button
              type="button"
              onClick={handleMerge}
              disabled={saving || selectedIds.length === 0}
              className="flex items-center gap-1.5 bg-primary text-white px-5 py-2 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-md disabled:opacity-50"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? 'Merging...' : `Merge ${selectedIds.length}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DuplicateMatchDialog;