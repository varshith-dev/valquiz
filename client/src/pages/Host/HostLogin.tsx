import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../../services/firebase';
import { signInWithPopup, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { AlertCircle, ShieldAlert } from 'lucide-react';

const checkAdminSession = () => {
  const loggedIn = localStorage.getItem('valquiz_admin_logged_in') === 'true';
  const loginTime = localStorage.getItem('valquiz_admin_login_time');
  if (loggedIn && loginTime) {
    const elapsed = Date.now() - Number(loginTime);
    const seventeenDaysMs = 17 * 24 * 60 * 60 * 1000;
    return elapsed < seventeenDaysMs;
  }
  return false;
};

const clearAdminSession = () => {
  localStorage.removeItem('valquiz_admin_logged_in');
  localStorage.removeItem('valquiz_admin_login_time');
};

const setAdminSession = () => {
  localStorage.setItem('valquiz_admin_logged_in', 'true');
  localStorage.setItem('valquiz_admin_login_time', Date.now().toString());
};

export const HostLogin: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    // If a valid local session exists within the 17 days, bypass check/redirect delay
    if (checkAdminSession()) {
      navigate('/a/host');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !user.isAnonymous) {
        const loginTime = localStorage.getItem('valquiz_admin_login_time');
        if (loginTime) {
          const elapsed = Date.now() - Number(loginTime);
          const seventeenDaysMs = 17 * 24 * 60 * 60 * 1000;
          if (elapsed >= seventeenDaysMs) {
            clearAdminSession();
            auth.signOut();
            setSessionChecked(true);
            return;
          }
        } else {
          setAdminSession();
        }
        navigate('/a/host');
      }
      setSessionChecked(true);
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      // Enforce local session persistence (survives browser restarts/closes)
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
      setAdminSession();
      navigate('/a/host');
    } catch (err: any) {
      console.error("Google Auth failed:", err);
      setError(err.message || 'Google Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!sessionChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Verifying credentials...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'var(--bg-primary)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div
        className="minimalist-card animate-pop-in"
        style={{
          width: '100%',
          maxWidth: '420px',
          border: '3px solid var(--text-primary)',
          backgroundColor: 'var(--bg-primary)',
          padding: '40px 32px',
          textAlign: 'center',
          boxShadow: 'var(--brutalist-shadow)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg-primary)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldAlert size={28} />
          </div>
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: '1.75rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            marginBottom: '8px',
          }}
        >
          Host Portal
        </h2>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.9rem',
            marginBottom: '32px',
          }}
        >
          ValQuiz administrators must authenticate to create sessions and access the dashboard.
        </p>

        {error && (
          <div
            style={{
              padding: '12px',
              border: '2px solid var(--text-primary)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.85rem',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="minimalist-button minimalist-button-primary"
          style={{
            width: '100%',
            padding: '14px 20px',
            fontFamily: 'var(--font-title)',
            fontSize: '1rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            borderRadius: '6px',
            border: '3px solid var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style={{ flexShrink: 0 }}>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
          </svg>
          {loading ? 'Authorizing...' : 'Sign in with Google'}
        </button>
      </div>

      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          fontWeight: 700,
          fontSize: '0.85rem',
          textDecoration: 'underline',
          cursor: 'pointer',
          marginTop: '24px',
        }}
      >
        Cancel and go back
      </button>
    </div>
  );
};

export default HostLogin;
