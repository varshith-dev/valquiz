import React from 'react';
import { Flame } from 'lucide-react';

interface LeaderboardBarProps {
  nickname: string;
  score: number;
  rank: number;
  streak: number;
  isMaxScore: boolean;
  maxScore: number;
}

export const LeaderboardBar: React.FC<LeaderboardBarProps> = ({
  nickname,
  score,
  rank,
  streak,
  isMaxScore,
  maxScore,
}) => {
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '16px',
        width: '100%',
      }}
      className="animate-fade-in-up"
    >
      {/* Rank Indicator */}
      <div
        style={{
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid var(--text-primary)',
          borderRadius: '50%',
          fontWeight: 800,
          fontFamily: 'var(--font-title)',
          backgroundColor: isMaxScore ? 'var(--color-yellow)' : 'var(--bg-secondary)',
          fontSize: '1rem',
        }}
      >
        {rank}
      </div>

      {/* Bar Frame */}
      <div
        style={{
          flexGrow: 1,
          position: 'relative',
          height: '44px',
          border: '2px solid var(--text-primary)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          overflow: 'hidden',
        }}
      >
        {/* Animated Bar fill */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            backgroundColor: isMaxScore ? 'var(--color-brand)' : 'var(--bg-primary)',
            borderRight: '2px solid var(--text-primary)',
            '--target-width': `${percentage}%`,
            zIndex: 1,
          } as React.CSSProperties}
          className="animate-bar-grow-horizontal"
        />

        {/* Player details */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            fontWeight: 700,
            fontSize: '1rem',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {nickname}
            {streak >= 3 && (
              <span
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
                title={`${streak} answer streak!`}
              >
                <Flame size={10} fill="currentColor" /> {streak}
              </span>
            )}
          </span>
          <span>{score} pts</span>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardBar;
