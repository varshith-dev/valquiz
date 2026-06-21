import React, { useEffect } from 'react';
import { useLocation as useRouteLocation, useNavigate as useRouteNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store';
import { updatePlayerStats, setHasAnswered } from '../../store/playerSlice';
import useSocket from '../../hooks/useSocket';
import { Award, Flame, TrendingUp } from 'lucide-react';

export const PlayerFeedback: React.FC = () => {
  const routeLocation = useRouteLocation();
  const navigate = useRouteNavigate();
  const dispatch = useDispatch();

  const { score, streak, rank } = useSelector((state: RootState) => state.player);

  // Check state passed via navigation
  const feedbackData = routeLocation.state || { chosen: 'A' };
  const isIncorrectForce = feedbackData.wrong || false;
  
  // Decide correct status (mock fallback or real socket score packet)
  const isCorrect = !isIncorrectForce && feedbackData.chosen === 'A';
  const addedPoints = isCorrect ? 850 : 0;

  useEffect(() => {
    // Reset answered indicator on mount
    dispatch(setHasAnswered(false));
    
    // Simulate updating points inside Redux store locally
    if (isCorrect) {
      const newScore = score + addedPoints;
      const newStreak = streak + 1;
      dispatch(updatePlayerStats({
        score: newScore,
        streak: newStreak,
        isCorrect: true,
        rank: rank || 1
      }));
    } else {
      dispatch(updatePlayerStats({
        streak: 0,
        isCorrect: false,
        rank: rank || 2
      }));
    }
  }, []);

  // Listen to socket triggers from host (next question or game finished)
  useSocket('game:next-question', () => {
    navigate('/player/question');
  });

  useSocket('game:finish', () => {
    navigate('/player/podium');
  });

  return (
    <div 
      className="brutalist-container"
      style={{
        backgroundColor: isCorrect ? 'var(--color-green)' : 'var(--color-red)',
        color: 'white',
        padding: '24px'
      }}
    >
      <div 
        className="brutalist-card animate-pop-in"
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          textAlign: 'center',
          padding: '36px 20px'
        }}
      >
        <h1 
          style={{ 
            fontSize: '3rem', 
            textTransform: 'uppercase', 
            marginBottom: '16px',
            color: isCorrect ? 'var(--color-green)' : 'var(--color-red)'
          }}
        >
          {isCorrect ? 'Correct!' : 'Incorrect'}
        </h1>

        <div style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '24px' }}>
          {isCorrect ? `+${addedPoints} Points` : 'Try again next time!'}
        </div>

        {/* Stats Row */}
        <div style={{ borderTop: '3px solid var(--text-primary)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Award size={18} /> Total Score</span>
            <span>{score + (isCorrect ? addedPoints : 0)} pts</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Flame size={18} /> Active Streak</span>
            <span style={{ color: (isCorrect ? streak + 1 : 0) >= 3 ? 'var(--color-accent)' : 'inherit' }}>
              {isCorrect ? streak + 1 : 0}{(isCorrect ? streak + 1 : 0) >= 3 ? ' (ACTIVE)' : ''}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><TrendingUp size={18} /> Current Rank</span>
            <span>#{isCorrect ? '1' : '2'}</span>
          </div>
        </div>
      </div>

      {/* Control triggers for standalone visual verification */}
      <div 
        className="brutalist-card"
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          padding: '16px',
          margin: 0
        }}
      >
        <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '12px', textAlign: 'center', textTransform: 'uppercase' }}>
          Offline Screen Controls
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => navigate('/player/question')}
            className="brutalist-button brutalist-button-blue" 
            style={{ flex: 1, fontSize: '0.8rem', padding: '8px' }}
          >
            Next Question
          </button>
          <button 
            onClick={() => navigate('/player/podium')}
            className="brutalist-button brutalist-button-yellow" 
            style={{ flex: 1, fontSize: '0.8rem', padding: '8px' }}
          >
            Go to Podium
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerFeedback;
