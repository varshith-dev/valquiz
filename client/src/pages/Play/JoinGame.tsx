import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ArrowRight, HelpCircle } from 'lucide-react';
import { setPin } from '../../store/gameSlice';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export const JoinGame: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const [gamePin, setGamePin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = gamePin.trim();
    if (!trimmed || trimmed.length !== 6) {
      setError('Please enter a valid 6-digit PIN');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Validate against the real server
      const res = await fetch(`${BACKEND_URL}/api/game/${trimmed}`);
      
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

      // Valid game — save PIN and navigate to lobby for nickname selection
      sessionStorage.setItem('valquiz_pin', trimmed);
      dispatch(setPin(trimmed));
      setLoading(false);
      navigate('/player/lobby');
    } catch (err) {
      console.error('PIN validation error:', err);
      setError('Could not reach game server. Is the server running?');
      setLoading(false);
    }
  };

  return (
    <div className="brutalist-container">
      <div className="brutalist-card" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', textTransform: 'uppercase' }}>
            Enter Game PIN
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', marginTop: '6px' }}>
            Enter the 6-digit quiz room code from the host screen
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '12px',
              border: '3px solid var(--text-primary)',
              backgroundColor: 'var(--color-red)',
              color: 'white',
              fontWeight: 700,
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handlePinSubmit}>
          <label className="brutalist-label">Room PIN</label>
          <input
            type="text"
            placeholder="e.g. 123456"
            value={gamePin}
            onChange={(e) => setGamePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="brutalist-input"
            disabled={loading}
            autoFocus
          />
          <button
            type="submit"
            className="brutalist-button brutalist-button-blue"
            disabled={loading}
            style={{ marginTop: '8px' }}
          >
            {loading ? 'Verifying...' : 'Join Game'} <ArrowRight size={18} />
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', gap: '12px', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.85rem' }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Cancel
        </button>
        <span>•</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <HelpCircle size={14} /> Need help?
        </span>
      </div>
    </div>
  );
};

export default JoinGame;
