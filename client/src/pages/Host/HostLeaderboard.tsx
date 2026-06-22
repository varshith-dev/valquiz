import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../../store';
import { setCurrentQuestionIndex, setStatus } from '../../store/gameSlice';
import HostNavigationRail from '../../components/Navigation/HostNavigationRail';
import LeaderboardBar from '../../components/Leaderboard/LeaderboardBar';
import { firestore } from '../../services/firebase';
import { doc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
import { Trophy, ArrowRight, Award } from 'lucide-react';

export const HostLeaderboard: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { questions, currentQuestionIndex, players, pin } = useSelector((state: RootState) => state.game);
  
  const activePlayers = players.length > 0 ? players : [];

  const maxScore = activePlayers.reduce((max, p) => p.score > max ? p.score : max, 0);

  const isLastQuestion = currentQuestionIndex >= questions.length - 1;

  const handleNextStep = async () => {
    if (!pin) return;

    if (isLastQuestion) {
      try {
        // Transition to podium in Firestore
        await setDoc(doc(firestore, 'game_sessions', pin), {
          status: 'podium'
        }, { merge: true });

        dispatch(setStatus('podium'));
        navigate('/a/host/podium');
      } catch (err) {
        console.error('Failed to transition to podium:', err);
      }
    } else {
      try {
        const nextIdx = currentQuestionIndex + 1;

        // 1. Clear all answers from the subcollection
        const answersSnap = await getDocs(collection(firestore, 'game_sessions', pin, 'answers'));
        const deletePromises = answersSnap.docs.map((d) => deleteDoc(d.ref));
        await Promise.all(deletePromises);

        // 2. Advance question index and revert status to question
        await setDoc(doc(firestore, 'game_sessions', pin), {
          status: 'question',
          currentQuestionIndex: nextIdx,
          questionStartTime: Date.now(),
          showResults: false,
          isHintRevealed: false
        }, { merge: true });

        dispatch(setCurrentQuestionIndex(nextIdx));
        dispatch(setStatus('question'));
        navigate('/a/host/question');
      } catch (err) {
        console.error('Failed to advance to the next question:', err);
      }
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
