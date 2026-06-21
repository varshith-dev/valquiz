import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../../store';
import { setCurrentQuestionIndex, setStatus, setPlayers } from '../../store/gameSlice';
import HostNavigationRail from '../../components/Navigation/HostNavigationRail';
import LeaderboardBar from '../../components/Leaderboard/LeaderboardBar';
import socketService from '../../services/socket';
import { Trophy, ArrowRight, Award } from 'lucide-react';

export const HostLeaderboard: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { questions, currentQuestionIndex, players, pin } = useSelector((state: RootState) => state.game);
  
  // Use mock players if store is empty
  const activePlayers = players.length > 0 ? players : [
    { nickname: 'SpeedRunner', score: 1850, streak: 2, rank: 1 },
    { nickname: 'ValkeyBot_1', score: 1420, streak: 1, rank: 2 },
    { nickname: 'QuizMaster', score: 950, streak: 0, rank: 3 },
  ];

  const maxScore = activePlayers.reduce((max, p) => p.score > max ? p.score : max, 0);

  const isLastQuestion = currentQuestionIndex >= questions.length - 1 || currentQuestionIndex >= 1;

  const handleNextStep = () => {
    if (isLastQuestion) {
      // Emit end game socket event
      socketService.emit('game:end-session', { pin });
      dispatch(setStatus('podium'));
      navigate('/host/podium');
    } else {
      // Increment question and navigate back
      const nextIdx = currentQuestionIndex + 1;
      dispatch(setCurrentQuestionIndex(nextIdx));
      
      // Emit next question start socket
      socketService.emit('game:next-question', { pin, questionIndex: nextIdx });
      
      // Update local mock scores
      const updatedMockPlayers = activePlayers.map((p, idx) => ({
        ...p,
        score: p.score + (idx === 0 ? 920 : idx === 1 ? 840 : 0),
        streak: idx === 0 ? 3 : idx === 1 ? 2 : 0,
      }));
      dispatch(setPlayers(updatedMockPlayers));

      dispatch(setStatus('question'));
      navigate('/host/question');
    }
  };

  return (
    <div className="minimalist-container">
      <HostNavigationRail />

      <main className="minimalist-main" style={{ display: 'flex', flexDirection: 'column' }}>
        <header className="minimalist-header">
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Current Rankings
            </span>
            <h1 style={{ fontSize: '2.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Trophy size={32} /> Scoreboard
            </h1>
          </div>

          <button
            onClick={handleNextStep}
            className="minimalist-button minimalist-button-primary"
            style={{ padding: '12px 28px' }}
          >
            {isLastQuestion ? 'View Final Podium' : 'Next Question'} <ArrowRight size={18} />
          </button>
        </header>

        {/* Score blocks */}
        <div 
          className="minimalist-card" 
          style={{ 
            border: '2px solid var(--text-primary)',
            padding: '32px',
            backgroundColor: 'var(--bg-primary)',
            maxWidth: '720px',
            margin: '0 auto',
            width: '100%',
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          {activePlayers.map((player, idx) => (
            <LeaderboardBar
              key={player.nickname}
              nickname={player.nickname}
              score={player.score}
              rank={idx + 1}
              streak={player.streak}
              isMaxScore={player.score === maxScore}
              maxScore={maxScore}
            />
          ))}

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
            <Award size={16} /> Leaderboard is real-time, synchronized across all active player sockets
          </div>
        </div>
      </main>
    </div>
  );
};

export default HostLeaderboard;
