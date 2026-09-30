import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import ThemeToggle from '../components/ThemeToggle';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', response.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid username or password');
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
        <h2 className="text-2xl font-bold mb-6 text-center text-text">Login</h2>

        {error && (
          <p className="text-danger text-sm mb-4 text-center">{error}</p>
        )}

        <label className="block mb-2 text-sm font-medium text-text">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
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
          Login
        </button>

        <p className="text-sm text-center mt-4 text-text">
          Don't have an account?{' '}
          <Link to="/register" className="text-secondary hover:underline">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Login;