import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import ThemeToggle from '../components/ThemeToggle';

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
    <div className="min-h-screen flex items-center justify-center bg-bg relative">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-card p-8 rounded-xl shadow-lg w-96"
      >
        <h2 className="text-2xl font-bold mb-6 text-center text-text">Register</h2>

        {error && (
          <p className="text-danger text-sm mb-4 text-center">{error}</p>
        )}
        {success && (
          <p className="text-success text-sm mb-4 text-center">
            Account created! Redirecting to login...
          </p>
        )}

        <label className="block mb-2 text-sm font-medium text-text">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 bg-card text-text rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-primary transition"
          required
        />

        <label className="block mb-2 text-sm font-medium text-text">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 bg-card text-text rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-primary transition"
          required
        />

        <label className="block mb-2 text-sm font-medium text-text">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 bg-card text-text rounded-lg px-3 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-primary transition"
          required
        />

        <button
          type="submit"
          className="w-full bg-primary text-white py-2 rounded-lg hover:opacity-90 transition"
        >
          Register
        </button>

        <p className="text-sm text-center mt-4 text-text">
          Already have an account?{' '}
          <Link to="/login" className="text-secondary hover:underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Register;