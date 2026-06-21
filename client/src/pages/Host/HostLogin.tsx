import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { AlertCircle, ShieldAlert } from 'lucide-react';

export const HostLogin: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate('/host');
        }
      } catch (err) {
        // Suppress mock/configuration warnings
      } finally {
        setSessionChecked(true);
      }
    };
    checkUser();
  }, [navigate]);

  const handleGithubLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: window.location.origin + '/host',
        },
      });

      if (error) throw error;
    } catch (err: any) {
      console.warn("OAuth failed or standalone mode active. Simulating session authorization...", err);
      // Hackathon sandbox fallback: simulate login and redirect to dashboard
      setError('Simulating Github Authorization (Sandbox Mode)...');
      setTimeout(() => {
        setLoading(false);
        navigate('/host');
      }, 1500);
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
          onClick={handleGithubLogin}
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
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
          </svg>
          {loading ? 'Authorizing...' : 'Sign in with GitHub'}
        </button>

        <button
          onClick={() => {
            setError('Bypassing Auth (Sandbox Mode)...');
            setLoading(true);
            setTimeout(() => {
              setLoading(false);
              navigate('/host');
            }, 1000);
          }}
          disabled={loading}
          className="minimalist-button"
          style={{
            width: '100%',
            padding: '14px 20px',
            fontFamily: 'var(--font-title)',
            fontSize: '1rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            borderRadius: '6px',
            border: '3px solid var(--text-primary)',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: '12px'
          }}
        >
          Bypass Auth (Sandbox Mode)
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
