import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../../store';
import { setHasAnswered, updatePlayerStats } from '../../store/playerSlice';
import { setCurrentQuestionIndex } from '../../store/gameSlice';
import AnswerButton from '../../components/Question/AnswerButton';
import socketService from '../../services/socket';
import { HelpCircle, Sparkles, CheckSquare } from 'lucide-react';
import { useTimer } from '../../hooks/useTimer';

const shapeMap = {
  A: (
    <svg className="shape-icon" viewBox="0 0 24 24">
      <polygon points="12,3 2,21 22,21" />
    </svg>
  ), // Triangle
  B: (
    <svg className="shape-icon" viewBox="0 0 24 24">
      <polygon points="12,2 22,12 12,22 2,12" />
    </svg>
  ), // Diamond
  C: (
    <svg className="shape-icon" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
    </svg>
  ), // Circle
  D: (
    <svg className="shape-icon" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  ), // Square
};

export const PlayerQuestion: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { pin } = useSelector((state: RootState) => state.game);
  const { nickname, hasAnswered } = useSelector((state: RootState) => state.player);
  
  const [startTime, setStartTime] = useState(Date.now());
  
  // Current question from Socket
  const [question, setQuestion] = useState<any>(null);
  const [qIndex, setQIndex] = useState(-1);
  
  const secondsLeft = useTimer(question ? (question.timeLimit || question.time_limit || 20) : 20);
  const isMultiChoice = question ? (question.correct && question.correct.length > 1) : false;
  
  // Answering states
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<string[]>([]);
  const [matches, setMatches] = useState<Record<string, string>>({});
  
  const [showHintPopup, setShowHintPopup] = useState(false);
  const [isHintUnlocked, setIsHintUnlocked] = useState(false);

  // Game phase states (driven by socket events)
  const [sessionStatus, setSessionStatus] = useState<string>('question');
  const [answerStats, setAnswerStats] = useState<Record<string, number>>({ A: 0, B: 0, C: 0, D: 0 });
  const [totalAnswersCount, setTotalAnswersCount] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState<string[]>([]);

  // Player stats from score:update
  const [localPlayerStats, setLocalPlayerStats] = useState<any>(null);
  const lastProcessedQIndexRef = useRef<number>(-1);

  // ─── Socket Event Listeners ────────────────────────
  useEffect(() => {
    if (!pin) return;

    // Ensure socket is connected
    socketService.connect();

    // New question arrives from server
    const handleNewQuestion = (data: any) => {
      const { qIndex: newQIndex, text, options, timeLimit, type, hint, media_url, pairs } = data;
      
      if (newQIndex !== lastProcessedQIndexRef.current) {
        lastProcessedQIndexRef.current = newQIndex;
        
        setQuestion({ text, options, timeLimit, type: type || 'mcq', hint, media_url, pairs });
        setQIndex(newQIndex);
        dispatch(setCurrentQuestionIndex(newQIndex));
        dispatch(setHasAnswered(false));
        setSelectedOption(null);
        setSelectedMultiOptions([]);
        setMatches({});
        setStartTime(Date.now());
        setIsHintUnlocked(false);
        setSessionStatus('question');
        setCorrectAnswers([]);
        setAnswerStats({ A: 0, B: 0, C: 0, D: 0 });
        setTotalAnswersCount(0);
        setLocalPlayerStats(null);
      }
    };

    // Question ended by host (show distribution)
    const handleQuestionEnded = (data: any) => {
      setSessionStatus('reveal_distribution');
      if (data.distribution) {
        setAnswerStats(data.distribution);
        setTotalAnswersCount(Object.values(data.distribution as Record<string, number>).reduce((a: number, b: number) => a + b, 0));
      }
    };

    // Answer reveal (show correct/incorrect + scores)
    const handleAnswerReveal = (data: any) => {
      setSessionStatus('reveal_answer');
      if (data.correct) setCorrectAnswers(data.correct);
      if (data.distribution) {
        setAnswerStats(data.distribution);
        setTotalAnswersCount(Object.values(data.distribution as Record<string, number>).reduce((a: number, b: number) => a + b, 0));
      }
    };

    // Individual score update for this player
    const handleScoreUpdate = (data: any) => {
      setLocalPlayerStats({
        score: data.score,
        streak: data.streak,
        rank: data.rank,
        lastAnswerCorrect: data.correct,
        lastAnswerPoints: data.pointsEarned,
      });
      dispatch(updatePlayerStats({
        score: data.score,
        streak: data.streak,
        rank: data.rank,
        isCorrect: data.correct,
      }));
    };

    // Hint revealed by host
    const handleHintRevealed = () => {
      setIsHintUnlocked(true);
    };

    // Game finished
    const handleGameFinished = (data: any) => {
      if (data.finalLeaderboard && nickname) {
        const myEntry = data.finalLeaderboard.find((entry: any) => entry.nickname === nickname);
        if (myEntry) {
          dispatch(updatePlayerStats({
            rank: myEntry.rank,
            score: myEntry.score,
          }));
        }
      }
      navigate('/player/podium');
    };

    // Go to leaderboard (host is showing leaderboard now)
    const handleGoLeaderboard = () => {
      setSessionStatus('leaderboard');
    };

    socketService.on('question:new', handleNewQuestion);
    socketService.on('question:ended', handleQuestionEnded);
    socketService.on('answer:reveal', handleAnswerReveal);
    socketService.on('score:update', handleScoreUpdate);
    socketService.on('hint:revealed', handleHintRevealed);
    socketService.on('game:finished', handleGameFinished);
    socketService.on('game:go-leaderboard', handleGoLeaderboard);
    socketService.on('podium:reveal', handleGameFinished);

    return () => {
      socketService.off('question:new');
      socketService.off('question:ended');
      socketService.off('answer:reveal');
      socketService.off('score:update');
      socketService.off('hint:revealed');
      socketService.off('game:finished');
      socketService.off('game:go-leaderboard');
      socketService.off('podium:reveal');
    };
  }, [pin, navigate, dispatch, nickname]);

  // Auto submit when time is up
  useEffect(() => {
    if (secondsLeft === 0 && !hasAnswered && question) {
      if (question.type === 'match') {
        submitAnswer(Object.values(matches));
      } else if (isMultiChoice) {
        submitAnswer(selectedMultiOptions);
      } else {
        submitAnswer([]);
      }
    }
  }, [secondsLeft, hasAnswered, question, matches, selectedMultiOptions, isMultiChoice]);

  // If no question received yet, show waiting screen
  if (!question) {
    return (
      <div className="brutalist-container" style={{ padding: '24px' }}>
        <div className="brutalist-card" style={{ textAlign: 'center', padding: '40px' }}>
          <h2 style={{ fontSize: '1.5rem', textTransform: 'uppercase', marginBottom: '8px' }}>Waiting for Question...</h2>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>The host will send the next question shortly.</p>
        </div>
      </div>
    );
  }

  // Submit Answer via Socket (replaces Firestore write)
  const submitAnswer = async (answerIds: string[]) => {
    if (!pin || !nickname || hasAnswered) return;

    dispatch(setHasAnswered(true));
    const responseTimeMs = Date.now() - startTime;

    socketService.emit('player:submit-answer', {
      pin,
      qIndex,
      answerIds,
      responseTimeMs,
    }, (res: any) => {
      if (!res?.success) {
        console.error('Failed to submit answer:', res?.error);
      }
    });
  };

  // Single choice submit
  const handleSingleAnswerSubmit = (option: 'A' | 'B' | 'C' | 'D') => {
    setSelectedOption(option);
    submitAnswer([option]);
  };

  // Multi choice toggling
  const handleMultiToggle = (optId: string) => {
    if (hasAnswered) return;
    if (selectedMultiOptions.includes(optId)) {
      setSelectedMultiOptions(selectedMultiOptions.filter((id) => id !== optId));
    } else {
      setSelectedMultiOptions([...selectedMultiOptions, optId]);
    }
  };

  // Multi choice submit
  const handleMultiSubmit = () => {
    if (selectedMultiOptions.length === 0 || hasAnswered) return;
    submitAnswer(selectedMultiOptions);
  };

  // Match choice selection
  const handleMatchSelect = (leftTerm: string, rightTerm: string) => {
    if (hasAnswered) return;
    setMatches({
      ...matches,
      [leftTerm]: rightTerm,
    });
  };

  // Match submit
  const handleMatchSubmit = () => {
    const totalRequired = question.pairs?.length || 0;
    const filledCount = Object.keys(matches).filter((k) => matches[k]).length;

    if (filledCount < totalRequired || hasAnswered) return;
    submitAnswer(Object.values(matches));
  };

  // Resolve matching pool right column values for select dropdowns
  const allRightOptions = question.pairs?.map((p: any) => p.right) || [];

  return (
    <div 
      className="brutalist-container"
      style={{
        padding: '16px',
        justifyContent: 'space-between',
        height: '100vh',
        boxSizing: 'border-box',
        position: 'relative'
      }}
    >
      {/* Top Header Banner */}
      <div 
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: '3px solid var(--text-primary)',
          backgroundColor: 'var(--bg-primary)',
          padding: '12px 20px',
          boxShadow: 'var(--brutalist-shadow)',
          fontFamily: 'var(--font-title)',
          fontWeight: 800,
          textTransform: 'uppercase',
          fontSize: '0.9rem'
        }}
      >
        <span>{nickname || 'Guest'}</span>
        {!hasAnswered && (
          <span 
            style={{ 
              backgroundColor: 'var(--color-yellow)', 
              color: '#272320', 
              padding: '2px 10px', 
              borderRadius: '4px', 
              border: '2px solid var(--text-primary)',
              fontWeight: 900
            }}
          >
            ⏱️ {secondsLeft}s
          </span>
        )}
        <span style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)', padding: '2px 8px' }}>
          Q{qIndex + 1} • PIN {pin || '0000'}
        </span>
      </div>

      {/* Question Text */}
      <div style={{ textAlign: 'center', padding: '16px 0', fontWeight: 700, fontSize: '1.1rem' }}>
        {question.text}
      </div>

      {/* Main Answering Area */}
      <div style={{ width: '100%', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', margin: '10px 0' }}>
        {question.type === 'match' ? (
          /* Match Answering Layout */
          <div 
            className="brutalist-card animate-fade-in-up"
            style={{ 
              width: '100%', 
              maxWidth: '480px', 
              alignSelf: 'center', 
              border: '3px solid var(--text-primary)',
              backgroundColor: 'var(--bg-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              padding: '20px'
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', borderBottom: '2px solid var(--text-primary)', paddingBottom: '8px' }}>
              Match Mappings
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {question.pairs?.map((pair: any, pIdx: number) => (
                <div key={pIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{pair.left}</span>
                  <select
                    disabled={hasAnswered}
                    value={matches[pair.left] || ''}
                    onChange={(e) => handleMatchSelect(pair.left, e.target.value)}
                    style={{
                      padding: '10px',
                      border: '2px solid var(--text-primary)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 700,
                      cursor: hasAnswered ? 'default' : 'pointer',
                      outline: 'none',
                      boxShadow: '2px 2px 0 var(--text-primary)'
                    }}
                  >
                    <option value="">Select correct match...</option>
                    {allRightOptions.map((rightVal: string) => (
                      <option key={rightVal} value={rightVal}>
                        {rightVal}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <button
              onClick={handleMatchSubmit}
              disabled={hasAnswered || Object.keys(matches).filter((k) => matches[k]).length < (question.pairs?.length || 0)}
              className="brutalist-button brutalist-button-green"
              style={{ marginTop: '12px', fontSize: '1rem', padding: '12px' }}
            >
              {hasAnswered ? 'Matches Submitted' : 'Submit Matches'}
            </button>
          </div>
        ) : isMultiChoice ? (
          /* Multi Choice Checkbox Layout */
          <div 
            className="brutalist-card animate-fade-in-up"
            style={{ 
              width: '100%', 
              maxWidth: '440px', 
              alignSelf: 'center', 
              border: '3px solid var(--text-primary)',
              backgroundColor: 'var(--bg-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              padding: '24px'
            }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 850, textTransform: 'uppercase', borderBottom: '2px solid var(--text-primary)', paddingBottom: '8px' }}>
              Select Choices
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {question.options.map((opt: any) => {
                const optId = opt.id;
                const isChecked = selectedMultiOptions.includes(optId);
                const isCorrect = correctAnswers.includes(optId);
                const showResults = sessionStatus === 'reveal_answer' || sessionStatus === 'leaderboard';

                let bg = isChecked ? 'var(--color-yellow)' : 'var(--bg-secondary)';
                let color = 'var(--text-primary)';
                let borderStyle = '2px solid var(--text-primary)';
                let filter = 'none';
                let animationClass = '';

                if (showResults) {
                  if (isCorrect) {
                    bg = 'var(--color-green)';
                    color = 'white';
                    borderStyle = '4px solid';
                    animationClass = 'animate-border-reveal-green';
                  } else if (isChecked && !isCorrect) {
                    bg = 'var(--color-red)';
                    color = 'white';
                    borderStyle = '4px solid var(--color-red)';
                  } else {
                    filter = 'grayscale(1) opacity(0.35)';
                  }
                } else if (sessionStatus === 'reveal_distribution') {
                  // Host ended question but hasn't revealed answers yet
                  // Keep all options visible, just disabled
                } else if (hasAnswered && selectedMultiOptions.length > 0) {
                  // Player actively submitted multi-choice answers
                  if (!isChecked) {
                    filter = 'grayscale(1) opacity(0.35)';
                  }
                }

                return (
                  <button
                    key={optId}
                    onClick={() => handleMultiToggle(optId)}
                    disabled={hasAnswered || showResults}
                    className={animationClass}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 18px',
                      border: borderStyle,
                      borderRadius: '6px',
                      backgroundColor: bg,
                      color: color,
                      fontWeight: 800,
                      fontSize: '1rem',
                      cursor: (hasAnswered || showResults) ? 'default' : 'pointer',
                      textAlign: 'left',
                      boxShadow: '2px 2px 0 var(--text-primary)',
                      filter: filter,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {isChecked ? <CheckSquare size={18} /> : <div style={{ width: 18, height: 18, border: '2px solid var(--text-primary)', borderRadius: '2px', backgroundColor: 'white' }} />}
                    <span>{optId}. {opt.text}</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleMultiSubmit}
              disabled={hasAnswered || selectedMultiOptions.length === 0}
              className="brutalist-button brutalist-button-blue"
              style={{ marginTop: '12px', fontSize: '1rem', padding: '12px' }}
            >
              {hasAnswered ? 'Answers Submitted' : 'Submit Answers'}
            </button>
          </div>
        ) : (
          /* MCQ Single Choice Layout */
          ((sessionStatus === 'reveal_distribution' || sessionStatus === 'reveal_answer' || sessionStatus === 'leaderboard' || (hasAnswered && selectedOption !== null)) ? (
            /* Transformed 1x Single Column Progress Bars Layout */
            <div 
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                width: '100%',
                margin: '0 auto',
                maxWidth: '480px'
              }}
            >
              {question.options.map((opt: any) => {
                const optId = opt.id as 'A' | 'B' | 'C' | 'D';
                const isSelected = selectedOption === optId;
                const isCorrectAns = correctAnswers.includes(optId);
                const showResults = sessionStatus === 'reveal_answer' || sessionStatus === 'leaderboard';

                const count = answerStats[optId] || 0;
                const total = totalAnswersCount || 1;
                const pct = Math.round((count / total) * 100);

                let isMasked = false;
                let fillColor = '';
                let colorOverride: 'green' | 'red' | null = null;
                let revealBorder = false;

                switch (optId) {
                  case 'A': fillColor = 'var(--color-red)'; break;
                  case 'B': fillColor = 'var(--color-blue)'; break;
                  case 'C': fillColor = 'var(--color-yellow)'; break;
                  case 'D': fillColor = 'var(--color-green)'; break;
                }

                if (showResults) {
                  // Host has revealed the correct answer
                  if (isCorrectAns) {
                    fillColor = 'var(--color-green)';
                    colorOverride = 'green';
                    revealBorder = true;
                  } else if (isSelected && !isCorrectAns) {
                    fillColor = 'var(--color-red)';
                    colorOverride = 'red';
                  } else {
                    isMasked = true;
                  }
                } else if (sessionStatus === 'reveal_distribution') {
                  // Host ended the question but hasn't revealed answers yet
                  // Show all options normally (no masking), just disabled
                  if (isSelected) {
                    // Highlight the player's selection
                  } else {
                    // Don't mask - keep options visible but neutral
                  }
                } else if (hasAnswered && selectedOption !== null) {
                  // Player actively selected and locked an answer
                  if (!isSelected) {
                    isMasked = true;
                  }
                }

                const borderStyle = revealBorder 
                  ? '4px solid' 
                  : (colorOverride === 'red' ? '4px solid var(--color-red)' : 'var(--brutalist-border-width) solid var(--text-primary)');

                // Check text color contrast
                const textColor = (isMasked)
                  ? 'var(--text-primary)'
                  : (fillColor === 'var(--color-red)' || fillColor === 'var(--color-blue)' || fillColor === 'var(--color-green)' || colorOverride === 'green' || colorOverride === 'red') 
                    ? 'white' 
                    : 'var(--text-primary)';

                return (
                  <div
                    key={optId}
                    className={`brutalist-card ${revealBorder ? 'animate-border-reveal-green' : ''}`}
                    style={{
                      position: 'relative',
                      width: '100%',
                      minHeight: '76px',
                      padding: '16px 20px',
                      margin: 0,
                      backgroundColor: 'var(--bg-secondary)',
                      border: borderStyle,
                      boxShadow: revealBorder ? undefined : '4px 4px 0px var(--text-primary)',
                      transform: isSelected ? 'translate(2px, 2px)' : undefined,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      filter: isMasked ? 'grayscale(1) opacity(0.35)' : 'none',
                      transition: 'all 0.3s ease',
                      cursor: 'default',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Progress Fill */}
                    <div 
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        bottom: 0,
                        width: `${pct}%`,
                        backgroundColor: fillColor,
                        transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)',
                        zIndex: 1,
                        opacity: 0.85
                      }}
                    />
                    
                    {/* Content Overlay */}
                    <div 
                      style={{
                        position: 'relative',
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        color: textColor
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ flexShrink: 0, color: 'currentColor' }}>
                          {shapeMap[optId]}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', wordBreak: 'break-word' }}>
                          {optId}. {opt.text}
                        </div>
                      </div>
                      
                      <div style={{ fontWeight: 950, fontSize: '1.25rem', paddingLeft: '16px' }}>
                        {pct}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* MCQ Option Buttons Layout (Standard 2x2 Grid) */
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridGap: '16px',
                width: '100%',
                maxHeight: '440px',
                flexGrow: 1
              }}
            >
              {question.options.map((opt: any) => {
                const optId = opt.id as 'A' | 'B' | 'C' | 'D';
                return (
                  <AnswerButton 
                    key={optId}
                    optionId={optId} 
                    text={`${optId}. ${opt.text}`} 
                    onClick={() => handleSingleAnswerSubmit(optId)} 
                    disabled={hasAnswered}
                    isSelected={selectedOption === optId}
                  />
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Answer Locked Notification (Waiting Phase) */}
      {hasAnswered && sessionStatus === 'question' && (selectedOption !== null || selectedMultiOptions.length > 0) && (
        <div style={{ textAlign: 'center', fontWeight: 750, fontSize: '1.1rem', color: 'var(--color-brand)', marginTop: '8px' }}>
          🔒 Answer locked. Waiting for host...
        </div>
      )}
      {hasAnswered && sessionStatus === 'question' && selectedOption === null && selectedMultiOptions.length === 0 && question.type !== 'match' && (
        <div style={{ textAlign: 'center', fontWeight: 750, fontSize: '1.1rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
          ⏱️ Time's up! Waiting for host...
        </div>
      )}

      {/* Stats Feedback Banner */}
      {(sessionStatus === 'reveal_answer' || sessionStatus === 'leaderboard') && (
        <div 
          className="brutalist-card animate-pop-in"
          style={{
            width: '100%',
            maxWidth: '440px',
            backgroundColor: localPlayerStats?.lastAnswerCorrect ? 'var(--color-green)' : 'var(--color-red)',
            color: 'white',
            textAlign: 'center',
            padding: '16px 20px',
            marginTop: '16px',
            boxShadow: 'var(--brutalist-shadow-lg)',
            alignSelf: 'center'
          }}
        >
          <h2 style={{ fontSize: '1.5rem', textTransform: 'uppercase', marginBottom: '8px' }}>
            {localPlayerStats?.lastAnswerCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </h2>
          <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '12px' }}>
            {localPlayerStats?.lastAnswerCorrect ? `+${localPlayerStats?.lastAnswerPoints || 0} Points` : 'Try again next time!'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '2px solid white', paddingTop: '10px', fontSize: '0.85rem', fontWeight: 800 }}>
            <div>Streak: {localPlayerStats?.streak || 0} 🔥</div>
            <div>Total: {localPlayerStats?.score || 0} pts 🏆</div>
          </div>
        </div>
      )}

      {(sessionStatus === 'reveal_answer' || sessionStatus === 'leaderboard') && (
        <div style={{ marginTop: '12px', textAlign: 'center', fontWeight: 600, fontSize: '0.9rem', opacity: 0.8 }}>
          Waiting for next question from host...
        </div>
      )}

      {/* Hint Button (Only shown when unlocked; blank if locked) */}
      {question.hint && isHintUnlocked && !hasAnswered && (
        <button
          onClick={() => setShowHintPopup(true)}
          className="brutalist-button"
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            backgroundColor: 'var(--color-yellow)',
            color: '#272320',
            cursor: 'pointer',
            borderStyle: 'solid',
            borderWidth: '2px',
            borderColor: 'var(--text-primary)',
            boxShadow: 'var(--brutalist-shadow)',
            transition: 'all 0.25s ease'
          }}
        >
          <Sparkles size={16} /> 
          Need a Hint? (Unlocked)
        </button>
      )}

      {/* Hint Popup */}
      {showHintPopup && (
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(39, 35, 32, 0.4)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: 1000
          }}
        >
          <div 
            className="brutalist-card animate-bubble-pop"
            style={{
              width: '100%',
              maxWidth: '360px',
              backgroundColor: 'var(--bg-primary)',
              border: '3px solid var(--text-primary)',
              padding: '24px',
              boxShadow: 'var(--brutalist-shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              textAlign: 'center'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--color-yellow)' }}>
              <HelpCircle size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>
                Question Hint
              </h3>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {question.hint}
              </p>
            </div>
            <button
              onClick={() => setShowHintPopup(false)}
              className="brutalist-button"
              style={{
                padding: '10px',
                fontSize: '0.9rem',
                backgroundColor: 'var(--text-primary)',
                color: 'var(--bg-primary)'
              }}
            >
              Back to Question
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerQuestion;
