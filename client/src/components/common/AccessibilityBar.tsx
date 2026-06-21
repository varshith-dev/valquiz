import React, { useEffect, useState } from 'react';
import { Eye, Sun, Moon } from 'lucide-react';

const getInitialTheme = (): 'light' | 'dark' | 'high-contrast' => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('valquiz_theme');
    if (saved === 'light' || saved === 'dark' || saved === 'high-contrast') {
      return saved;
    }
  }
  return 'dark'; // Default theme
};

export const AccessibilityBar: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'high-contrast'>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('valquiz_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    if (theme === 'dark') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('high-contrast');
    } else {
      setTheme('dark');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 1000,
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      }}
    >
      <button
        onClick={toggleTheme}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: 'var(--text-primary)',
          color: 'var(--bg-primary)',
          border: '2px solid var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
        title="Toggle contrast/theme options"
      >
        {theme === 'light' && <Moon size={18} />}
        {theme === 'dark' && <Sun size={18} />}
        {theme === 'high-contrast' && <Eye size={18} />}
      </button>
    </div>
  );
};

export default AccessibilityBar;
