import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Laptop, ShieldCheck } from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        backgroundColor: 'var(--bg-primary)',
        fontFamily: 'var(--font-body)',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '800px', width: '100%', marginBottom: '48px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: '3.5rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '-1px',
          }}
        >
          ValQuiz
        </h1>
        <p
          style={{
            fontSize: '1.25rem',
            color: 'var(--text-secondary)',
            fontWeight: 500,
            maxWidth: '600px',
            margin: '0 auto',
          }}
        >
          The high-performance, real-time quiz game powered by Valkey. Built with no-stress balanced scoring and zero latency lag.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '32px',
          width: '100%',
          maxWidth: '800px',
        }}
      >
        {/* Play Card (Brutalist Style) */}
        <div
          className="brutalist-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            margin: 0,
            height: '320px',
            backgroundColor: 'var(--color-blue)',
            color: 'white',
          }}
        >
          <div style={{ textAlign: 'center', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '12px', textTransform: 'uppercase' }}>Join Game</h2>
            <p style={{ opacity: 0.9, fontWeight: 500 }}>Enter a PIN code on your device and join the action instantly!</p>
          </div>
          <button
            onClick={() => navigate('/play')}
            className="brutalist-button"
            style={{
              backgroundColor: 'white',
              color: 'var(--text-primary)',
              boxShadow: '4px 4px 0 var(--text-primary)',
            }}
          >
            <Play size={20} fill="currentColor" /> Enter Lobby PIN
          </button>
        </div>

        {/* Host Card (Minimalist Style) */}
        <div
          className="minimalist-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '320px',
            border: '3px solid var(--text-primary)',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <div style={{ textAlign: 'center', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>Host Session</h2>
            <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Create quizzes manually or let our AI generator generate them in seconds.</p>
          </div>
          <button
            onClick={() => navigate('/host')}
            className="minimalist-button minimalist-button-primary"
            style={{
              width: '100%',
              padding: '16px 24px',
              fontFamily: 'var(--font-title)',
              fontSize: '1.1rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              borderRadius: 0,
              border: '3px solid var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <Laptop size={20} /> Host Dashboard
          </button>
        </div>
      </div>

      {/* Footer Info */}
      <div style={{ marginTop: '64px', display: 'flex', gap: '24px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={16} /> Anti-Bot Protection
        </span>
        <span>•</span>
        <span>Latency Compensated</span>
        <span>•</span>
        <span>Open Source</span>
      </div>
    </div>
  );
};

export default HomePage;
