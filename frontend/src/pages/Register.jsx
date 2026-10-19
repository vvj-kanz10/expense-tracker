import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import AuthShell, { Field } from '../components/AuthShell';
import { User, Mail, Lock, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';

// A simple 0-3 score so the user gets a hint while typing (it does not block registering)
function passwordStrength(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

const STRENGTH_LABELS = ['', 'Weak', 'Okay', 'Strong'];
const STRENGTH_BARS = ['', 'bg-danger', 'bg-warning', 'bg-success'];
const STRENGTH_TEXT = ['', 'text-danger', 'text-warning', 'text-success'];

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false); // blocks a second submit instantly, before React re-renders
  const navigate = useNavigate();

  const strength = passwordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLock.current) return; // a request is already in flight
    submitLock.current = true;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/auth/register', { username, email, password });
      setError('');
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError('Registration failed. Try a different username.');
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start tracking your money in a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Login
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-danger text-sm text-center font-medium bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 animate-fadeIn">
            {error}
          </p>
        )}
        {success && (
          <p className="flex items-center justify-center gap-2 text-success text-sm text-center font-medium bg-success/10 border border-success/20 rounded-xl px-3 py-2 animate-fadeIn">
            <CheckCircle2 size={16} /> Account created! Redirecting to login...
          </p>
        )}

        <Field
          label="Username"
          icon={User}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Choose a username"
          autoComplete="username"
          disabled={submitting}
        />

        <Field
          label="Email"
          icon={Mail}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={submitting}
        />

        <Field
          label="Password"
          icon={Lock}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Choose a password"
          autoComplete="new-password"
          disabled={submitting}
        >
          {password && (
            <div className="mt-2 flex items-center gap-2 animate-fadeIn">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                      strength >= n ? STRENGTH_BARS[strength] : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                ))}
              </div>
              <span className={`text-xs font-semibold w-12 text-right ${STRENGTH_TEXT[strength]}`}>
                {STRENGTH_LABELS[strength]}
              </span>
            </div>
          )}
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-95 active:scale-95 transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Creating account...</span>
            </>
          ) : (
            <>
              <span>Register</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}

export default Register;