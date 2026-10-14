import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import ThemeToggle from '../components/ThemeToggle';
import { Wallet } from 'lucide-react';

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/register', { username, email, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError('Registration failed. Try a different username.');
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col justify-between">
      {/* Header Bar */}
      <header className="flex items-center justify-between px-6 sm:px-8 py-3 border-b border-gray-200 dark:border-gray-700 bg-card/90 backdrop-blur">
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

      {/* Main Centered Register Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <form
          onSubmit={handleSubmit}
          className="bg-card p-8 rounded-2xl shadow-lg w-full max-w-sm border border-gray-200/80 dark:border-gray-700/80"
        >
          <h2 className="text-2xl font-bold mb-6 text-center text-text">Create Account</h2>

          {error && (
            <p className="text-danger text-sm mb-4 text-center font-medium animate-fadeIn">{error}</p>
          )}
          {success && (
            <p className="text-success text-sm mb-4 text-center font-medium animate-fadeIn">
              Account created! Redirecting to login...
            </p>
          )}

          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
            className="w-full border border-gray-300 dark:border-gray-600 bg-bg text-text rounded-xl px-3.5 py-2.5 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition shadow-sm"
            required
          />

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full border border-gray-300 dark:border-gray-600 bg-bg text-text rounded-xl px-3.5 py-2.5 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition shadow-sm"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Choose a password"
            className="w-full border border-gray-300 dark:border-gray-600 bg-bg text-text rounded-xl px-3.5 py-2.5 mb-6 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition shadow-sm"
            required
          />

          <button
            type="submit"
            className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-95 active:scale-95 transition shadow-sm"
          >
            Register
          </button>

          <p className="text-sm text-center mt-5 text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Login
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}

export default Register;