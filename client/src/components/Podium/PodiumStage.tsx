import React from 'react';
import { Crown } from 'lucide-react';

interface PodiumPlayer {
  nickname: string;
  score: number;
}

interface PodiumStageProps {
  players: PodiumPlayer[];
}

export const PodiumStage: React.FC<PodiumStageProps> = ({ players }) => {
  // Sort players (ensure 1st, 2nd, 3rd)
  const first = players[0] || { nickname: 'Player 1', score: 0 };
  const second = players[1] || { nickname: 'Player 2', score: 0 };
  const third = players[2] || { nickname: 'Player 3', score: 0 };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: '24px',
        height: '320px',
        width: '100%',
        maxWidth: '600px',
        margin: '0 auto',
        paddingBottom: '20px',
      }}
    >
      {/* 2nd Place */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flex: 1,
        }}
        className="animate-podium-rise"
      >
        <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '8px' }}>
          {second.nickname}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '12px' }}>
          {second.score} pts
        </div>
        <div
          style={{
            width: '100%',
            height: '140px',
            backgroundColor: 'var(--bg-secondary)',
            border: '3px solid var(--text-primary)',
            borderBottom: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-title)',
            fontSize: '3rem',
            fontWeight: 900,
            boxShadow: 'var(--brutalist-shadow)',
          }}
        >
          2
        </div>
      </div>

      {/* 1st Place */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flex: 1,
          transform: 'translateY(-10px)',
        }}
        className="animate-podium-rise"
      >
        <div style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Crown size={18} style={{ color: 'var(--text-primary)' }} /> {first.nickname}
        </div>
        <div style={{ color: 'var(--color-brand)', fontWeight: 700, fontSize: '1rem', marginBottom: '12px' }}>
          {first.score} pts
        </div>
        <div
          style={{
            width: '100%',
            height: '190px',
            backgroundColor: 'var(--color-yellow)',
            border: '3px solid var(--text-primary)',
            borderBottom: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-title)',
            fontSize: '4.5rem',
            fontWeight: 900,
            boxShadow: 'var(--brutalist-shadow)',
          }}
        >
          1
        </div>
      </div>

      {/* 3rd Place */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flex: 1,
        }}
        className="animate-podium-rise"
      >
        <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '8px' }}>
          {third.nickname}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '12px' }}>
          {third.score} pts
        </div>
        <div
          style={{
            width: '100%',
            height: '100px',
            backgroundColor: 'var(--bg-secondary)',
            border: '3px solid var(--text-primary)',
            borderBottom: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-title)',
            fontSize: '2.5rem',
            fontWeight: 900,
            boxShadow: 'var(--brutalist-shadow)',
          }}
        >
          3
        </div>
      </div>
    </div>
  );
};

export default PodiumStage;
