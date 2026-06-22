import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { setPin } from '../../store/gameSlice';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  const [gamePin, setGamePin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-fill and submit if PIN is in search parameters
  useEffect(() => {
    const urlPin = searchParams.get('pin');
    if (urlPin && urlPin.length === 6 && /^\d+$/.test(urlPin)) {
      setGamePin(urlPin);
      autoSubmitPin(urlPin);
    }
  }, [searchParams]);

  const autoSubmitPin = async (pinCode: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/game/${pinCode}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Game not found. Check the PIN and try again.');
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.game?.status !== 'lobby') {
        setError('This game has already started or ended.');
        setLoading(false);
        return;
      }

      sessionStorage.setItem('valquiz_pin', pinCode);
      dispatch(setPin(pinCode));
      setLoading(false);
      navigate('/player/lobby');
    } catch (err) {
      console.error('PIN validation error:', err);
      setError('Could not reach game server. Is it online?');
      setLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = gamePin.trim();
    if (!trimmed || trimmed.length !== 6) {
      setError('Please enter a valid 6-digit PIN');
      return;
    }
    await autoSubmitPin(trimmed);
  };

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
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '440px', width: '100%', marginBottom: '32px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: '4.5rem',
            fontWeight: 900,
            color: 'var(--text-primary)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '-2px',
          }}
        >
          ValQuiz
        </h1>
        <p
          style={{
            fontSize: '1.05rem',
            color: 'var(--text-secondary)',
            fontWeight: 650,
            margin: '0 auto',
            lineHeight: 1.4,
          }}
        >
          High-performance, real-time Valkey quiz engine.
        </p>
      </div>

      <div
        className="brutalist-card animate-pop-in"
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '32px 24px',
          backgroundColor: 'var(--bg-primary)',
          border: '3px solid var(--text-primary)',
          boxShadow: 'var(--brutalist-shadow)',
          marginBottom: '40px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.75rem', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
            Enter Game PIN
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', marginTop: '6px' }}>
            Enter the 6-digit room code to join the lobby
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '12px',
              border: '2.5px solid var(--text-primary)',
              backgroundColor: 'var(--color-red)',
              color: 'white',
              fontWeight: 750,
              fontSize: '0.85rem',
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handlePinSubmit}>
          <input
            type="text"
            placeholder="000000"
            value={gamePin}
            onChange={(e) => setGamePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '1.75rem',
              fontWeight: 800,
              textAlign: 'center',
              letterSpacing: '8px',
              border: '3px solid var(--text-primary)',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              outline: 'none',
              marginBottom: '16px',
              fontFamily: 'var(--font-title)',
            }}
            disabled={loading}
            autoFocus
          />
          <button
            type="submit"
            className="brutalist-button brutalist-button-blue"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '1.1rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Joining Lobby...' : 'Join Game'} <ArrowRight size={18} />
          </button>
        </form>
      </div>

      {/* Footer Info */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} /> Anti-Bot Protection
          </span>
          <span>•</span>
          <span>Latency Compensated</span>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
