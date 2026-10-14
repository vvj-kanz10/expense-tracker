import { useEffect, useState } from 'react';
import { getRules, deleteRule } from '../api/rules';
import { ChevronDown, Sparkles, Trash2, BookOpen } from 'lucide-react';

export default function LearnedRules({ refreshKey }) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadRules = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getRules();
      setRules(data || []);
    } catch (e) {
      setError('Could not load learned rules.');
    } finally {
      setLoading(false);
    }
  };

  // Load when the panel is opened, and again if refreshKey changes (e.g. after an edit)
  useEffect(() => {
    if (open) loadRules();
  }, [open, refreshKey]);

  const handleDelete = async (rule, e) => {
    e.stopPropagation();
    if (!window.confirm(`Forget this rule for "${rule.matchText}"?`)) return;
    try {
      await deleteRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch (e) {
      setError('Could not delete that rule.');
    }
  };

  return (
    <div className="bg-card text-text rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-all">
      {/* Clickable Header */}
      <div
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-6 cursor-pointer hover:bg-bg/50 transition select-none"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <BookOpen size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text flex items-center gap-2">
              What the app has learned
              {!loading && rules.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                  {rules.length}
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              When you correct a category or merchant, it is remembered for future uploads.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-gray-400">
          <span className="text-xs font-medium hidden sm:inline">
            
          </span>
          <ChevronDown
            size={18}
            className={`transition-transform duration-300 ${open ? 'rotate-180 text-primary' : ''}`}
          />
        </div>
      </div>

      {/* Expandable Content Body */}
      {open && (
        <div className="px-6 pb-6 pt-2 border-t border-gray-100 dark:border-gray-800 animate-fadeIn">
          {loading && <p className="text-sm text-gray-400 py-4 text-center">Loading rules...</p>}
          {error && <p className="text-sm text-danger py-2">{error}</p>}

          {!loading && !error && rules.length === 0 && (
            <div className="text-center py-6 text-gray-400 text-sm space-y-1">
              <Sparkles size={24} className="mx-auto text-primary/40 mb-2" />
              <p className="font-medium text-text">Nothing learned yet</p>
              <p className="text-xs">
                Edit a transaction's category or merchant and it will show up here.
              </p>
            </div>
          )}

          {!loading && !error && rules.length > 0 && (
            <ul className="space-y-2.5 mt-2">
              {rules.map((rule) => (
                <li
                  key={rule.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200/80 dark:border-gray-700/80 px-4 py-3 bg-bg/40 hover:bg-bg transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text truncate">"{rule.matchText}"</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      <span className="text-primary font-medium">{rule.category}</span>
                      {rule.merchant ? ` · ${rule.merchant}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(rule, e)}
                    title="Forget rule"
                    aria-label="Forget rule"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-danger hover:bg-card transition shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}