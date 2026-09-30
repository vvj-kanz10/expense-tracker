import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className="p-2 rounded-full bg-card border border-gray-200 dark:border-gray-700 hover:opacity-80 transition"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun size={20} className="text-primary" /> : <Moon size={20} className="text-secondary" />}
    </button>
  );
}

export default ThemeToggle;