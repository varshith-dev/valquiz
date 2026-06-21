import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../../store';
import { setHasAnswered } from '../../store/playerSlice';
import socketService from '../../services/socket';
import AnswerButton from '../../components/Question/AnswerButton';
import useSocket from '../../hooks/useSocket';
import { HelpCircle, Sparkles, CheckSquare } from 'lucide-react';

export const PlayerQuestion: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { pin, questions, currentQuestionIndex } = useSelector((state: RootState) => state.game);
  const { nickname, hasAnswered } = useSelector((state: RootState) => state.player);
  
  const [startTime] = useState(Date.now());
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  
  // Answering states
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<string[]>([]);
  const [matches, setMatches] = useState<Record<string, string>>({});
  
  const [showHintPopup, setShowHintPopup] = useState(false);
  const [isHintUnlocked, setIsHintUnlocked] = useState(false);

  const reduxHintRevealed = useSelector((state: RootState) => state.game.isHintRevealed);

  // Sync active question from host socket broadcast
  useSocket('game:broadcast-question', (data: any) => {
    if (data && data.question) {
      setCurrentQuestion(data.question);
      setIsHintUnlocked(false); // Reset client hint lock on new question
    }
  });

  // Listen for real-time hint unlocks from host
  useSocket('game:reveal-hint', () => {
    setIsHintUnlocked(true);
  });

  useSocket('question:over', () => {
    navigate('/player/feedback');
  });

  // Resolve active question structure (Socket real-time vs. local Redux fallback)
  const currentIdx = currentQuestionIndex < 0 ? 0 : currentQuestionIndex;
  const reduxQuestion = questions[currentIdx] || {
    type: 'mcq',
    text: 'Waiting for question details...',
    options: [
      { id: 'A', text: 'Option A' },
      { id: 'B', text: 'Option B' },
      { id: 'C', text: 'Option C' },
      { id: 'D', text: 'Option D' }
    ],
    correct: ['A'],
    time_limit: 20
  };

  const question = currentQuestion || reduxQuestion;
  const isMultiChoice = question.correct && question.correct.length > 1;

  // Track if host has unlocked hints for this question
  const hintUnlocked = isHintUnlocked || !!reduxHintRevealed;

  // Single choice submit
  const handleSingleAnswerSubmit = (option: 'A' | 'B' | 'C' | 'D') => {
    if (hasAnswered) return;
    
    setSelectedOption(option);
    dispatch(setHasAnswered(true));

    const responseTime = (Date.now() - startTime) / 1000;

    socketService.emit('game:submit-answer', {
      pin,
      nickname,
      answer: option,
      responseTime,
    });

    setTimeout(() => {
      navigate('/player/feedback', { state: { chosen: option } });
    }, 600);
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

    dispatch(setHasAnswered(true));
    const responseTime = (Date.now() - startTime) / 1000;

    socketService.emit('game:submit-answer', {
      pin,
      nickname,
      answer: selectedMultiOptions,
      responseTime,
    });

    setTimeout(() => {
      navigate('/player/feedback', { state: { chosen: selectedMultiOptions.join(', ') } });
    }, 600);
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

    dispatch(setHasAnswered(true));
    const responseTime = (Date.now() - startTime) / 1000;

    socketService.emit('game:submit-answer', {
      pin,
      nickname,
      answer: matches,
      responseTime,
    });

    setTimeout(() => {
      navigate('/player/feedback', { state: { chosen: 'Matched Pairs' } });
    }, 600);
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
          PIN {pin || '0000'}
        </span>
      </div>

      {/* Main Answering Area */}
      <div style={{ width: '100%', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', margin: '20px 0' }}>
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
            <p style={{ fontWeight: 600 }}>Waiting for other players to submit...</p>
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
                    <span>Option {optId}</span>
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
                  text={`Option ${optId}`} 
                  onClick={() => handleSingleAnswerSubmit(optId)} 
                  disabled={hasAnswered}
                  isSelected={selectedOption === optId}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Bar: Hint & Dev Simulator Bypasses */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
        {/* Optional Hint Button (Locked/Unlocked) */}
        {question.hint && !hasAnswered && (
          <button
            onClick={() => hintUnlocked && setShowHintPopup(true)}
            disabled={!hintUnlocked}
            className="brutalist-button"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: hintUnlocked ? 'var(--color-yellow)' : 'var(--bg-secondary)',
              color: hintUnlocked ? '#272320' : 'var(--text-secondary)',
              cursor: hintUnlocked ? 'pointer' : 'not-allowed',
              opacity: hintUnlocked ? 1 : 0.7,
              borderStyle: hintUnlocked ? 'solid' : 'dashed',
              borderWidth: '2px',
              borderColor: 'var(--text-primary)',
              boxShadow: hintUnlocked ? 'var(--brutalist-shadow)' : 'none',
              transition: 'all 0.25s ease'
            }}
          >
            <Sparkles size={16} /> 
            {hintUnlocked ? 'Need a Hint? (Unlocked)' : 'Hint Locked by Host'}
          </button>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => navigate('/player/feedback', { state: { chosen: 'A' } })}
            className="brutalist-button" 
            style={{ flex: 1, fontSize: '0.8rem', padding: '10px', backgroundColor: 'var(--bg-secondary)' }}
          >
            Bypass Win
          </button>
          <button 
            onClick={() => navigate('/player/feedback', { state: { chosen: 'B', wrong: true } })}
            className="brutalist-button" 
            style={{ flex: 1, fontSize: '0.8rem', padding: '10px', backgroundColor: 'var(--bg-secondary)' }}
          >
            Bypass Lose
          </button>
        </div>
      </div>

      {/* Optional Hint Popup Overlay Card */}
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
