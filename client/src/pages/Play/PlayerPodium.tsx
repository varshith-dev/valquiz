import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../../store';
import { resetPlayer } from '../../store/playerSlice';
import { resetGame } from '../../store/gameSlice';
import { Trophy, Home, Award } from 'lucide-react';

export const PlayerPodium: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { nickname, score, rank } = useSelector((state: RootState) => state.player);

  const handleFinish = () => {
    dispatch(resetPlayer());
    dispatch(resetGame());
    navigate('/');
  };

  const getRankText = (r: number) => {
    if (r === 1) return '1ST';
    if (r === 2) return '2ND';
    if (r === 3) return '3RD';
    return `${r}TH`;
  };

  return (
    <div className="brutalist-container" style={{ backgroundColor: 'var(--color-yellow)' }}>
      <div 
        className="brutalist-card animate-float"
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          textAlign: 'center',
          padding: '40px 24px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <Trophy size={64} color="var(--color-yellow)" fill="var(--color-yellow)" style={{ stroke: 'var(--text-primary)', strokeWidth: 2 }} />
        </div>

        <h1 style={{ fontSize: '2.5rem', textTransform: 'uppercase', marginBottom: '8px' }}>
          Game Finished!
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '24px' }}>
          Great job, {nickname || 'Player'}!
        </p>

        {/* Big Rank Block */}
        <div 
          style={{
            border: '3px solid var(--text-primary)',
            padding: '24px',
            backgroundColor: 'var(--bg-secondary)',
            marginBottom: '24px',
            boxShadow: 'var(--brutalist-shadow)'
          }}
        >
          <div style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Your Final Placement
          </div>
          <div style={{ fontSize: '3rem', fontWeight: 900, marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {getRankText(rank || 1)}
          </div>
        </div>

        {/* Total Score */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '1.25rem', marginBottom: '32px' }}>
          <Award size={22} />
          {score} TOTAL POINTS
        </div>

        <button 
          onClick={handleFinish}
          className="brutalist-button brutalist-button-green"
        >
          <Home size={18} /> Back To Main Menu
        </button>
      </div>
    </div>
  );
};

export default PlayerPodium;
