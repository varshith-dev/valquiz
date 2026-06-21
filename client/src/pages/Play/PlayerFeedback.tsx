import React, { useEffect, useCallback } from 'react';
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

  const { nickname, score } = useSelector((state: RootState) => state.player);

  // Get answer result from navigation state (passed by PlayerQuestion after answer:result)
  const result = routeLocation.state || {};
  const isCorrect = result.correct ?? false;
  const pointsEarned = result.pointsEarned ?? 0;
  const newStreak = result.streak ?? 0;

  useEffect(() => {
    // Reset answered indicator on mount
    dispatch(setHasAnswered(false));
    
    // Update player stats from server result
    dispatch(updatePlayerStats({
      score: score + pointsEarned,
      streak: newStreak,
      isCorrect,
    }));
  }, []);

  // Listen for next question from server
  const handleNextQuestion = useCallback(() => {
    navigate('/player/question');
  }, [navigate]);
  useSocket('question:new', handleNextQuestion);

  // Listen for game finished
  const handleGameFinished = useCallback((data: any) => {
    if (data && data.finalLeaderboard && nickname) {
      const myEntry = data.finalLeaderboard.find((entry: any) => entry.nickname === nickname);
      if (myEntry) {
        dispatch(updatePlayerStats({
          rank: myEntry.rank,
          score: myEntry.score,
        }));
      }
    }
    navigate('/player/podium');
  }, [navigate, dispatch, nickname]);
  useSocket('game:finished', handleGameFinished);

  const handlePodiumReveal = useCallback(() => {
    navigate('/player/podium');
  }, [navigate]);
  useSocket('podium:reveal', handlePodiumReveal);

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
          {isCorrect ? `+${pointsEarned} Points` : 'Try again next time!'}
        </div>

        {/* Stats Row */}
        <div style={{ borderTop: '3px solid var(--text-primary)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Award size={18} /> Total Score</span>
            <span>{score + pointsEarned} pts</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Flame size={18} /> Active Streak</span>
            <span style={{ color: newStreak >= 3 ? 'var(--color-accent)' : 'inherit' }}>
              {newStreak}{newStreak >= 3 ? ' (ACTIVE)' : ''}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><TrendingUp size={18} /> Status</span>
            <span>{isCorrect ? '✓ On Track' : '✗ Keep Going'}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '16px', textAlign: 'center', fontWeight: 600, fontSize: '0.9rem', opacity: 0.8 }}>
        Waiting for next question from host...
      </div>
    </div>
  );
};

export default PlayerFeedback;
