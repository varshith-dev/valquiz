import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../../store';
import { setHintRevealed, setPlayers, setStatus, setQuestions } from '../../store/gameSlice';
import HostNavigationRail from '../../components/Navigation/HostNavigationRail';
import CountdownTimer from '../../components/Timer/CountdownTimer';
import useTimer from '../../hooks/useTimer';
import socketService from '../../services/socket';
import { Check, BarChart2, Pause, Play, Sparkles } from 'lucide-react';

export const HostQuestion: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { questions, currentQuestionIndex, isHintRevealed, pin } = useSelector((state: RootState) => state.game);
  
  // Set default question index to 0 if not set
  const currentIdx = currentQuestionIndex < 0 ? 0 : currentQuestionIndex;
  
  const question = questions[currentIdx] || {
    text: 'Waiting for question...',
    options: [],
    correct: [],
    timeLimit: 20,
    time_limit: 20,
    hint: '',
  };

  const timeLimit = question.timeLimit || question.time_limit || 20;

  const [answeredCount, setAnsweredCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [answerDistribution, setAnswerDistribution] = useState<Record<string, number>>({ A: 0, B: 0, C: 0, D: 0 });
  const [phase, setPhase] = useState<'question' | 'reveal_distribution' | 'reveal_answer'>('question');

  // Hook timer countdown (supports pause/resume)
  const secondsLeft = useTimer(timeLimit, () => {
    handleQuestionEnd();
  }, isPaused);

  // ─── Socket Event Listeners ────────────────────────
  useEffect(() => {
    if (!pin) return;

    socketService.connect();

    // Real-time answer count from server
    const handleAnswerCount = (data: any) => {
      setAnsweredCount(data.count);
    };

    // Answer distribution update
    const handleDistribution = (data: any) => {
      if (data.distribution) {
        setAnswerDistribution(data.distribution);
      }
    };

    const handleQuestionEnded = (data: any) => {
      if (data.distribution) {
        setAnswerDistribution(data.distribution);
      }
    };

    // Leaderboard update after scoring
    const handleLeaderboard = (data: any) => {
      if (data.leaderboard) {
        dispatch(setPlayers(data.leaderboard));
      }
    };

    // Answer reveal complete (from our own emit, reflected back)
    const handleAnswerReveal = (data: any) => {
      if (data.distribution) {
        setAnswerDistribution(data.distribution);
      }
      if (data.leaderboard) {
        dispatch(setPlayers(data.leaderboard));
      }
    };

    const handleStateSync = (data: any) => {
      if (data.answerCount !== undefined) {
        setAnsweredCount(data.answerCount);
      }
      if (data.leaderboard) {
        dispatch(setPlayers(data.leaderboard));
      }
      if (data.distribution) {
        setAnswerDistribution(data.distribution);
      }
      if (data.questions) {
        dispatch(setQuestions(data.questions));
      }
    };

    const handleConnect = () => {
      socketService.emit('game:request-sync', { pin, role: 'host' });
    };

    socketService.on('answer:count', handleAnswerCount);
    socketService.on('answer:distribution', handleDistribution);
    socketService.on('question:ended', handleQuestionEnded);
    socketService.on('leaderboard:update', handleLeaderboard);
    socketService.on('answer:reveal', handleAnswerReveal);
    socketService.on('game:state-sync', handleStateSync);
    socketService.on('connect', handleConnect);

    // Request initial sync
    if (socketService.isConnected()) {
      socketService.emit('game:request-sync', { pin, role: 'host' });
    }

    return () => {
      socketService.off('answer:count');
      socketService.off('answer:distribution');
      socketService.off('question:ended');
      socketService.off('leaderboard:update');
      socketService.off('answer:reveal');
      socketService.off('game:state-sync');
      socketService.off('connect', handleConnect);
    };
  }, [pin, dispatch]);

  const handleQuestionEnd = () => {
    setIsPaused(true);
    setPhase('reveal_distribution');

    if (pin) {
      socketService.emit('host:end-question', { pin });
    }
  };

  const handleRevealAnswer = () => {
    setPhase('reveal_answer');
    if (pin) {
      socketService.emit('host:reveal-answer', { pin });
    }
  };

  const handleGoToLeaderboard = () => {
    if (pin) {
      socketService.emit('host:go-leaderboard', { pin });
    }
    dispatch(setStatus('leaderboard'));
    navigate('/a/host/leaderboard');
  };

  const handleRevealHint = () => {
    dispatch(setHintRevealed(true));
    if (pin) {
      socketService.emit('host:reveal-hint', { pin });
    }
  };

  const getOptionColor = (optId: string) => {
    if (phase === 'reveal_answer') {
      return question.correct?.includes(optId) ? 'var(--color-green)' : 'rgba(39, 35, 32, 0.1)';
    }
    switch (optId) {
      case 'A': return 'var(--color-red)';
      case 'B': return 'var(--color-blue)';
      case 'C': return 'var(--color-yellow)';
      case 'D': return 'var(--color-green)';
      default: return 'var(--bg-secondary)';
    }
  };

  return (
    <div className="minimalist-container">
      <HostNavigationRail />

      <main className="minimalist-main" style={{ display: 'flex', flexDirection: 'column' }}>
        <header className="minimalist-header">
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Question {currentIdx + 1} of {questions.length || '?'}
            </span>
            <h1 style={{ fontSize: '2rem', marginTop: '4px' }}>{question.text}</h1>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {phase === 'question' && question.hint && (
              <button
                onClick={handleRevealHint}
                disabled={isHintRevealed}
                className="minimalist-button"
                style={{
                  backgroundColor: isHintRevealed ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-secondary)',
                  color: isHintRevealed ? 'var(--color-green)' : 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: isHintRevealed ? 'not-allowed' : 'pointer'
                }}
              >
                <Sparkles size={16} />
                {isHintRevealed ? 'Hint Revealed' : 'Reveal Hint'}
              </button>
            )}
            {phase === 'question' && (
              <>
                <button 
                  onClick={() => setIsPaused(!isPaused)} 
                  className="minimalist-button"
                  style={{
                    backgroundColor: isPaused ? 'var(--color-yellow)' : 'var(--bg-secondary)',
                    color: isPaused ? '#272320' : 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
                  {isPaused ? 'Resume Timer' : 'Pause Timer'}
                </button>
                <button onClick={handleQuestionEnd} className="minimalist-button">
                  End Question
                </button>
              </>
            )}
            {phase === 'reveal_distribution' && (
              <button onClick={handleRevealAnswer} className="minimalist-button minimalist-button-primary" style={{ padding: '12px 28px' }}>
                Reveal Correct Answer
              </button>
            )}
            {phase === 'reveal_answer' && (
              <button onClick={handleGoToLeaderboard} className="minimalist-button minimalist-button-primary" style={{ padding: '12px 28px' }}>
                Go to Leaderboard
              </button>
            )}
          </div>
        </header>

        {/* Dynamic visual game container */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '32px', flexGrow: 1, alignItems: 'center' }}>
          {/* Timer and score stats column */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
            <CountdownTimer seconds={phase === 'question' ? secondsLeft : 0} totalDuration={timeLimit} />
            
            <div 
              style={{ 
                border: '2px solid var(--text-primary)', 
                padding: '16px', 
                textAlign: 'center',
                backgroundColor: 'var(--bg-secondary)',
                width: '100%',
                borderRadius: '6px'
              }}
            >
              <div style={{ fontSize: '2rem', fontWeight: 900 }}>{answeredCount}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Answers Locked
              </div>
            </div>
          </div>

          {/* Answer choices grid / Chart distribution displays */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Display Question Image Media Card if present */}
            {question.media_url && (
              <div 
                style={{ 
                  border: '2px solid var(--text-primary)', 
                  borderRadius: '6px', 
                  overflow: 'hidden', 
                  maxHeight: '220px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  backgroundColor: 'white'
                }}
              >
                <img 
                  src={question.media_url} 
                  alt="Question media" 
                  style={{ maxHeight: '220px', objectFit: 'contain', width: 'auto' }} 
                />
              </div>
            )}

            {question.type !== 'match' && (
              <div 
                className="minimalist-card animate-fade-in-up"
                style={{
                  border: '2px solid var(--text-primary)',
                  padding: '20px',
                  backgroundColor: 'var(--bg-primary)'
                }}
              >
                <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart2 size={18} /> Answer Distribution
                </h3>
                
                {/* Horizontal simple chart bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                    const count = answerDistribution[opt] || 0;
                    const total = Object.values(answerDistribution).reduce((a: number, b: number) => a + b, 0) || 1;
                    const pct = (count / total) * 100;
                    return (
                      <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontWeight: 800, width: '20px' }}>{opt}</span>
                        <div style={{ flexGrow: 1, height: '24px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--text-primary)', overflow: 'hidden' }}>
                          <div 
                            style={{ 
                              width: `${pct}%`, 
                              height: '100%', 
                              backgroundColor: getOptionColor(opt),
                              transition: 'width 1s ease'
                            }} 
                          />
                        </div>
                        <span style={{ fontWeight: 700, width: '30px', textAlign: 'right' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Answer Display Grid */}
            <div style={{ width: '100%' }}>
              {phase !== 'reveal_distribution' && (
                question.type === 'match' ? (
                  /* Match the Following results mapping representation */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px' }}>Correct Pair Matches:</h3>
                    {question.pairs?.map((pair: any, pIdx: number) => (
                      <div 
                        key={pIdx}
                        style={{
                          border: '2px solid var(--text-primary)',
                          padding: '16px 20px',
                          backgroundColor: phase === 'reveal_answer' ? 'var(--color-green)' : 'var(--bg-secondary)',
                          color: phase === 'reveal_answer' ? 'white' : 'var(--text-primary)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <span>{pair.left}</span>
                        <span style={{ fontSize: '1.25rem', padding: '0 12px' }}>➔</span>
                        <span>{pair.right}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* MCQ Grid rendering options */
                  <div 
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gridGap: '20px' 
                    }}
                  >
                    {(question.options || []).map((opt: any) => {
                      const optId = opt.id;
                      const isCorrectAns = question.correct?.includes(optId);
                      return (
                        <div
                          key={optId}
                          style={{
                            border: '2.5px solid var(--text-primary)',
                            padding: '20px',
                            backgroundColor: getOptionColor(optId),
                            color: (phase === 'reveal_answer' && !isCorrectAns) ? 'var(--text-secondary)' : 'var(--text-primary)',
                            fontWeight: 700,
                            fontSize: '1.15rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderRadius: '6px',
                            transition: 'all 0.3s ease',
                            boxShadow: phase === 'reveal_answer' && isCorrectAns ? '0 0 16px rgba(34, 197, 94, 0.3)' : 'none'
                          }}
                        >
                          <span>{optId}. {opt.text}</span>
                          {phase === 'reveal_answer' && isCorrectAns && (
                            <div 
                              style={{
                                backgroundColor: 'var(--color-green)',
                                color: 'white',
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px solid white'
                              }}
                            >
                              <Check size={14} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HostQuestion;
