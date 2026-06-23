import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../../store';
import { setCurrentQuestionIndex, setStatus } from '../../store/gameSlice';
import HostNavigationRail from '../../components/Navigation/HostNavigationRail';
import LeaderboardBar from '../../components/Leaderboard/LeaderboardBar';
import socketService from '../../services/socket';
import { Trophy, ArrowRight, Award } from 'lucide-react';


export const HostLeaderboard: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { questions, currentQuestionIndex, players, pin } = useSelector((state: RootState) => state.game);
  
  const activePlayers = players.length > 0 ? players : [];

  const maxScore = activePlayers.reduce((max, p) => p.score > max ? p.score : max, 0);

  const isLastQuestion = currentQuestionIndex >= questions.length - 1;

  React.useEffect(() => {
    if (!pin) return;
    socketService.connect();

    const handleConnect = () => {
      socketService.emit('game:request-sync', { pin, role: 'host' });
    };

    socketService.on('connect', handleConnect);

    if (socketService.isConnected()) {
      socketService.emit('game:request-sync', { pin, role: 'host' });
    }

    return () => {
      socketService.off('connect', handleConnect);
    };
  }, [pin]);

  const handleNextStep = () => {
    if (!pin) return;

    socketService.emit('host:next-question', { pin }, (res: any) => {
      if (res && res.success) {
        if (res.finished) {
          dispatch(setStatus('podium'));
          navigate('/a/host/podium');
        } else {
          const nextIdx = currentQuestionIndex + 1;
          dispatch(setCurrentQuestionIndex(nextIdx));
          dispatch(setStatus('question'));
          navigate('/a/host/question');
        }
      } else {
        console.error('Failed to advance to the next question:', res?.error || 'Unknown error');
      }
    });
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
          {activePlayers.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, padding: '40px 0' }}>
              No player scores yet. Scores will appear after players answer questions.
            </div>
          ) : (
            activePlayers.map((player, idx) => (
              <LeaderboardBar
                key={player.nickname}
                nickname={player.nickname}
                score={player.score}
                rank={idx + 1}
                streak={player.streak}
                isMaxScore={player.score === maxScore}
                maxScore={maxScore}
              />
            ))
          )}

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
            <Award size={16} /> Leaderboard is real-time, synchronized across all active player sessions
          </div>
        </div>
      </main>
    </div>
  );
};

export default HostLeaderboard;
