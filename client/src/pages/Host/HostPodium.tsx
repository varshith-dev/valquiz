import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../../store';
import { resetGame } from '../../store/gameSlice';
import HostNavigationRail from '../../components/Navigation/HostNavigationRail';
import PodiumStage from '../../components/Podium/PodiumStage';
import { Home, RefreshCw } from 'lucide-react';

interface Particle {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
}

export const HostPodium: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { pin, players } = useSelector((state: RootState) => state.game);
  
  // Confetti particles state
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Generate 60 dynamic confetti particles
    const colors = ['#ef4444', '#3b82f6', '#eab308', '#22c55e', '#6366f1', '#f43f5e'];
    const generated: Particle[] = Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // percentage offset
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 3,
    }));
    setParticles(generated);
  }, []);

  const activePlayers = players.length > 0 ? players : [
    { nickname: 'SpeedRunner', score: 2770 },
    { nickname: 'ValkeyBot_1', score: 2260 },
    { nickname: 'QuizMaster', score: 950 },
  ];

  const handleReset = () => {
    if (pin) {
      // Cleanup the active game session in localStorage
      localStorage.removeItem(`valquiz_game_session_${pin}`);

      const activeGamesRaw = localStorage.getItem('valquiz_active_games');
      if (activeGamesRaw) {
        try {
          const activeGames = JSON.parse(activeGamesRaw);
          const updated = activeGames.filter((p: string) => p !== pin);
          localStorage.setItem('valquiz_active_games', JSON.stringify(updated));
        } catch (e) {
          console.error('Failed to cleanup active game PIN', e);
        }
      }
    }
    dispatch(resetGame());
    navigate('/');
  };

  return (
    <div className="minimalist-container" style={{ overflow: 'hidden', position: 'relative' }}>
      <HostNavigationRail />

      {/* Confetti canvas animation container */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 'var(--nav-rail-width)',
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 99
        }}
      >
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              top: '-10px',
              left: `${p.x}%`,
              width: '8px',
              height: '8px',
              backgroundColor: p.color,
              borderRadius: Math.random() > 0.5 ? '50%' : '0%',
              opacity: 0.8,
              transform: 'translateY(0) rotate(0deg)',
              animation: `confetti-fall ${p.duration}s linear infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Confetti custom animation keyframes injected directly via styled tag */}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
          }
          100% {
            transform: translateY(110vh) rotate(360deg);
          }
        }
      `}</style>

      <main className="minimalist-main" style={{ display: 'flex', flexDirection: 'column', zIndex: 10 }}>
        <header className="minimalist-header">
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Final Standings
            </span>
            <h1 style={{ fontSize: '2.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Grand Finale
            </h1>
          </div>

          <button
            onClick={handleReset}
            className="minimalist-button minimalist-button-primary"
            style={{ padding: '12px 28px' }}
          >
            <Home size={18} /> Exit Game
          </button>
        </header>

        {/* Podium center staging */}
        <div 
          style={{ 
            flexGrow: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <PodiumStage players={activePlayers} />
          
          <div style={{ marginTop: '48px', display: 'flex', gap: '16px' }}>
            <button onClick={handleReset} className="minimalist-button">
              <RefreshCw size={16} /> Play Another Quiz
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HostPodium;
