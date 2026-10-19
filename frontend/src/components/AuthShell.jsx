
import { useState } from 'react';
import ThemeToggle from './ThemeToggle';
import { ScanText, Gauge, ShieldCheck, Check, Eye, EyeOff, Sparkles, Target } from 'lucide-react';

const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI that reads your statement',
    text: 'Upload a PDF or CSV and every transaction is categorised for you.',
  },
  {
    icon: Target,
    title: 'Budgets, goals and forecasts',
    text: 'See where you overspend and what you can save each month.',
  },
];

// One input with an icon on the left. Password inputs get a show/hide button.
export function Field({
  label,
  icon: Icon,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  required = true,
  children,
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';

  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">
        {label}
      </label>

      <div className="relative">
        <Icon
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />

        <input
          type={isPassword && visible ? 'text' : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          required={required}
          className={`w-full border border-gray-300 dark:border-gray-600 bg-bg text-text rounded-xl pl-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-sm disabled:opacity-60 ${
            isPassword ? 'pr-11' : 'pr-3.5'
          }`}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            title={visible ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-text transition cursor-pointer"
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>

      {children}
    </div>
  );
}

// Shared page frame for Login and Register
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}) {
  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <header className="flex items-center justify-between px-6 sm:px-8 py-3 border-b border-gray-200 dark:border-gray-700 bg-card/90 backdrop-blur">
        <div className="flex items-center gap-3">
          <img
            src="/logo.svg"
            alt="MoneyTrack AI"
            className="h-10 w-10"
          />

          <div>
            <h1 className="text-lg font-bold text-text leading-tight">
              MoneyTrack AI
            </h1>
            <p className="text-xs text-gray-400 font-medium">
              AI-Powered Smart Expense Tracker
            </p>
          </div>
        </div>

        <ThemeToggle />
      </header>

      <main className="flex-1 grid lg:grid-cols-2">
        {/* Brand panel */}
        <aside className="hidden lg:flex relative overflow-hidden items-center justify-center p-12 bg-gradient-to-br from-primary/15 via-card to-secondary/10 border-r border-gray-200/60 dark:border-gray-700/60">
          <div className="absolute -left-20 -top-20 w-72 h-72 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-secondary/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-md space-y-8 animate-rise">
            <div className="space-y-3">
              <h2 className="text-3xl font-extrabold tracking-tight text-text leading-tight">
  Track your money, <br />understand it better.
</h2>
<p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
  Upload your bank statement and MoneyTrack AI sorts it, charts it and checks it against your budget.
</p>
            </div>

            <ul className="space-y-5">
              {FEATURES.map(({ icon: Icon, title: featureTitle, text }) => (
                <li
                  key={featureTitle}
                  className="flex items-start gap-3.5"
                >
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                    <Icon size={18} />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-text">
                      {featureTitle}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                      {text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Data privacy information */}
            <div className="rounded-2xl border border-primary/25 bg-card/70 p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-text">
                <ShieldCheck size={18} className="text-primary" />
                How your data is handled
              </div>

              <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                <li className="flex items-start gap-2">
                  <Check
                    size={14}
                    className="text-primary mt-0.5 shrink-0"
                  />
                  <span>
                    Account numbers, UPI IDs and reference numbers are removed
                    before anything reaches the AI.
                  </span>
                </li>

                <li className="flex items-start gap-2">
                  <Check
                    size={14}
                    className="text-primary mt-0.5 shrink-0"
                  />
                  <span>
                    Your statement file isn't kept. We save only the
                    transactions, with sensitive details masked.
                  </span>
                </li>

                <li className="flex items-start gap-2">
                  <Check
                    size={14}
                    className="text-primary mt-0.5 shrink-0"
                  />
                  <span>
                    Every account is private. Only you can see your data.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </aside>

        {/* Form side */}
        <section className="flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-sm animate-rise">
            <div className="bg-card p-8 rounded-2xl shadow-xl border border-gray-200/80 dark:border-gray-700/80">
              <div className="text-center mb-6 space-y-1.5">
                <h2 className="text-2xl font-bold tracking-tight text-text">
                  {title}
                </h2>
                <p className="text-sm text-gray-400">{subtitle}</p>
              </div>

              {children}
            </div>

            {footer && (
              <p className="text-sm text-center mt-5 text-gray-400">
                {footer}
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
