import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import AuthShell, { Field } from '../components/AuthShell';
import { User, Lock, Loader2, ArrowRight } from 'lucide-react';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loggingIn) return;
    setError('');
    setLoggingIn(true);

    try {
      const response = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', response.data.token);

      // Brief pause so the button state doesn't flash
      setTimeout(() => {
        navigate('/dashboard');
      }, 300);
    } catch (err) {
      setLoggingIn(false);
      setError('Invalid username or password');
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to see your dashboard."
      footer={
        <>
          Don't have an account?{' '}
          <Link to="/register" className="text-primary font-semibold hover:underline">
            Register
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

        <Field
          label="Username"
          icon={User}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your username"
          autoComplete="username"
          disabled={loggingIn}
        />

        <Field
          label="Password"
          icon={Lock}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          autoComplete="current-password"
          disabled={loggingIn}
        />

        <button
          type="submit"
          disabled={loggingIn}
          className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-95 active:scale-95 transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
        >
          {loggingIn ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Logging in...</span>
            </>
          ) : (
            <>
              <span>Login</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}

export default Login;