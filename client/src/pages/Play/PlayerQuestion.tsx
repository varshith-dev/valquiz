import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../../store';
import { setHasAnswered, updatePlayerStats } from '../../store/playerSlice';
import { setCurrentQuestionIndex } from '../../store/gameSlice';
import AnswerButton from '../../components/Question/AnswerButton';
import { firestore } from '../../services/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { HelpCircle, Sparkles, CheckSquare } from 'lucide-react';

export const PlayerQuestion: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { pin } = useSelector((state: RootState) => state.game);
  const { nickname, hasAnswered } = useSelector((state: RootState) => state.player);
  
  const [startTime, setStartTime] = useState(Date.now());
  
  // Current question from Firestore
  const [question, setQuestion] = useState<any>(null);
  const [qIndex, setQIndex] = useState(-1);
  
  // Answering states
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<string[]>([]);
  const [matches, setMatches] = useState<Record<string, string>>({});
  
  const [showHintPopup, setShowHintPopup] = useState(false);
  const [isHintUnlocked, setIsHintUnlocked] = useState(false);

  // Keep track of player stats locally to prevent race conditions during transitions
  const [localPlayerStats, setLocalPlayerStats] = useState<any>(null);

  // Subscribe to player's stats document in real-time
  useEffect(() => {
    if (!pin || !nickname) return;

    const unsubscribe = onSnapshot(doc(firestore, 'game_sessions', pin, 'players', nickname), (docSnap) => {
      if (docSnap.exists()) {
        setLocalPlayerStats(docSnap.data());
      }
    });

    return () => unsubscribe();
  }, [pin, nickname]);

  // Subscribe to game session document in Firestore
  useEffect(() => {
    if (!pin) return;

    const unsubscribe = onSnapshot(doc(firestore, 'game_sessions', pin), (docSnap) => {
      if (docSnap.exists()) {
        const sessionData = docSnap.data();

        // 1. Check for game finished / podium transition
        if (sessionData.status === 'finished' || sessionData.status === 'podium') {
          // If we have final leaderboard, update stats
          if (sessionData.leaderboard && nickname) {
            const myEntry = sessionData.leaderboard.find((entry: any) => entry.nickname === nickname);
            if (myEntry) {
              dispatch(updatePlayerStats({
                rank: myEntry.rank,
                score: myEntry.score,
              }));
            }
          }
          navigate('/player/podium');
          return;
        }

        // 2. Transition to results/feedback screen
        if (sessionData.status === 'leaderboard') {
          if (localPlayerStats) {
            dispatch(updatePlayerStats({
              streak: localPlayerStats.streak,
              isCorrect: localPlayerStats.lastAnswerCorrect,
            }));

            // Navigate to feedback page
            navigate('/player/feedback', {
              state: {
                correct: localPlayerStats.lastAnswerCorrect,
                correctAnswer: question?.correct || [],
                pointsEarned: localPlayerStats.lastAnswerPoints || 0,
                streak: localPlayerStats.streak || 0,
                responseTimeMs: localPlayerStats.lastResponseTimeMs || 0,
              }
            });
          }
          return;
        }

        // 3. Question update sync
        if (sessionData.status === 'question') {
          const currentIdx = sessionData.currentQuestionIndex;
          if (currentIdx !== undefined && currentIdx >= 0) {
            const activeQuestion = sessionData.questions?.[currentIdx];
            if (activeQuestion) {
              // Trigger state reset only if this is a new question
              if (currentIdx !== qIndex) {
                setQuestion(activeQuestion);
                setQIndex(currentIdx);
                dispatch(setCurrentQuestionIndex(currentIdx));
                dispatch(setHasAnswered(false));
                setSelectedOption(null);
                setSelectedMultiOptions([]);
                setMatches({});
                setStartTime(Date.now());
                setIsHintUnlocked(false);
              }

              // Hint sync
              if (sessionData.isHintRevealed) {
                setIsHintUnlocked(true);
              }
            }
          }
        }
      }
    });

    return () => unsubscribe();
  }, [pin, qIndex, navigate, dispatch, nickname, localPlayerStats, question]);

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

  const isMultiChoice = question.correct && question.correct.length > 1;

  // Submit Answer utility to write to Firestore
  const submitAnswer = async (answerIds: string[]) => {
    if (!pin || !nickname || hasAnswered) return;

    dispatch(setHasAnswered(true));
    const responseTimeMs = Date.now() - startTime;

    try {
      await setDoc(doc(firestore, 'game_sessions', pin, 'answers', nickname), {
        nickname,
        qIndex,
        answerIds,
        responseTimeMs,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('Failed to submit answer to Firestore:', err);
    }
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
        {hasAnswered ? (
          /* Locked State */
          <div 
            className="brutalist-card" 
            style={{ 
              textAlign: 'center', 
              backgroundColor: 'var(--color-brand)', 
              color: 'white',
              padding: '40px 20px',
              alignSelf: 'center',
              width: '100%',
              maxWidth: '400px'
            }}
          >
            <h2 style={{ fontSize: '2rem', textTransform: 'uppercase', marginBottom: '8px' }}>Answer Locked!</h2>
            <p style={{ fontWeight: 600 }}>Waiting for results...</p>
          </div>
        ) : question.type === 'match' ? (
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
                      cursor: 'pointer',
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
              disabled={Object.keys(matches).filter((k) => matches[k]).length < (question.pairs?.length || 0)}
              className="brutalist-button brutalist-button-green"
              style={{ marginTop: '12px', fontSize: '1rem', padding: '12px' }}
            >
              Submit Matches
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
                return (
                  <button
                    key={optId}
                    onClick={() => handleMultiToggle(optId)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 18px',
                      border: '2px solid var(--text-primary)',
                      borderRadius: '6px',
                      backgroundColor: isChecked ? 'var(--color-yellow)' : 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontWeight: 800,
                      fontSize: '1rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: '2px 2px 0 var(--text-primary)',
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
              disabled={selectedMultiOptions.length === 0}
              className="brutalist-button brutalist-button-blue"
              style={{ marginTop: '12px', fontSize: '1rem', padding: '12px' }}
            >
              Submit Answers
            </button>
          </div>
        ) : (
          /* MCQ Option Buttons Layout */
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
        )}
      </div>

      {/* Hint Button */}
      {question.hint && !hasAnswered && (
        <button
          onClick={() => isHintUnlocked && setShowHintPopup(true)}
          disabled={!isHintUnlocked}
          className="brutalist-button"
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            backgroundColor: isHintUnlocked ? 'var(--color-yellow)' : 'var(--bg-secondary)',
            color: isHintUnlocked ? '#272320' : 'var(--text-secondary)',
            cursor: isHintUnlocked ? 'pointer' : 'not-allowed',
            opacity: isHintUnlocked ? 1 : 0.7,
            borderStyle: isHintUnlocked ? 'solid' : 'dashed',
            borderWidth: '2px',
            borderColor: 'var(--text-primary)',
            boxShadow: isHintUnlocked ? 'var(--brutalist-shadow)' : 'none',
            transition: 'all 0.25s ease'
          }}
        >
          <Sparkles size={16} /> 
          {isHintUnlocked ? 'Need a Hint? (Unlocked)' : 'Hint Locked by Host'}
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
