import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import ThemeToggle from '../components/ThemeToggle';
import { Wallet, Loader2 } from 'lucide-react';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoggingIn(true);

    try {
      const response = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', response.data.token);
      
      // Brief 300ms pause for a smooth visual transition
      setTimeout(() => {
        navigate('/dashboard');
      }, 300);
    } catch (err) {
      setLoggingIn(false);
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col justify-between">
      {/* Header Bar */}
      <header className="flex items-center justify-between px-6 sm:px-8 py-3 border-b border-gray-200 dark:border-gray-700 bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Wallet size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text leading-tight">ArivGo Expense</h1>
            <p className="text-xs text-gray-400 font-medium">AI-Powered Smart Expense Tracker</p>
          </div>
        </div>

        <ThemeToggle />
      </header>

      {/* Main Centered Login Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <form
          onSubmit={handleSubmit}
          className="bg-card p-8 rounded-2xl shadow-xl w-full max-w-sm border border-gray-200 dark:border-gray-700 transition-all"
        >
          <h2 className="text-2xl font-bold mb-6 text-center text-text tracking-tight">Welcome Back</h2>

          {error && (
            <p className="text-danger text-sm mb-4 text-center font-medium animate-fadeIn">{error}</p>
          )}

          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            disabled={loggingIn}
            className="w-full border border-gray-300 dark:border-gray-600 bg-bg text-text rounded-xl px-3.5 py-2.5 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition disabled:opacity-60"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            disabled={loggingIn}
            className="w-full border border-gray-300 dark:border-gray-600 bg-bg text-text rounded-xl px-3.5 py-2.5 mb-6 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition disabled:opacity-60"
            required
          />

          <button
            type="submit"
            disabled={loggingIn}
            className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-95 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loggingIn ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Logging in...</span>
              </>
            ) : (
              'Login'
            )}
          </button>

          <p className="text-sm text-center mt-5 text-gray-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary font-semibold hover:underline">
              Register
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}

export default Login;