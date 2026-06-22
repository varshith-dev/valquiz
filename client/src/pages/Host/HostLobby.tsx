import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../../store';
import { setPin, setQuestions, setStatus, setPlayers, setCurrentQuestionIndex } from '../../store/gameSlice';
import HostNavigationRail from '../../components/Navigation/HostNavigationRail';
import { safeRef, safeGet, auth, firestore, setDoc } from '../../services/firebase';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { Users, Play, AlertCircle, Copy, Check } from 'lucide-react';
import type { Question } from '../../types/game';

export const HostLobby: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { pin } = useSelector((state: RootState) => state.game);
  const [localPlayers, setLocalPlayers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [customQuizzes, setCustomQuizzes] = useState<any[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('default');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  
  const [authChecked, setAuthChecked] = useState(false);

  // Authenticate host credentials
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user: any) => {
      if (user && !user.isAnonymous) {
        setAuthChecked(true);
      } else {
        navigate('/a/host/login');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleCopyPin = () => {
    if (pin) {
      const shareUrl = `https://valquiz.oqens.me/?pin=${pin}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch((err) => {
        console.error('Failed to copy share link to clipboard', err);
      });
    }
  };

  // Create game session on mount once authenticated
  useEffect(() => {
    if (!authChecked) return;

    if (!pin && !creating) {
      setCreating(true);

      const initGame = async () => {
        try {
          // Generate a unique 6-digit PIN
          let generatedPin = '';
          let attempts = 0;
          let unique = false;
          while (attempts < 50 && !unique) {
            generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
            const docSnap = await getDoc(doc(firestore, 'game_sessions', generatedPin));
            if (!docSnap.exists()) {
              unique = true;
            }
            attempts++;
          }

          if (!unique) {
            throw new Error('Failed to generate a unique session PIN.');
          }

          const newSession = {
            pin: generatedPin,
            status: 'lobby',
            currentQuestionIndex: -1,
            createdAt: Date.now(),
            mode: 'classic',
            selectedQuizId: 'default',
            questions: mockQuestions,
            totalQuestions: mockQuestions.length,
            showResults: false,
            hostId: auth.currentUser?.uid || 'HOST'
          };

          // Save game session to Firestore
          await setDoc(doc(firestore, 'game_sessions', generatedPin), newSession);

          dispatch(setPin(generatedPin));
          sessionStorage.setItem('valquiz_pin', generatedPin);
          dispatch(setQuestions(mockQuestions));
          setCreating(false);
        } catch (e: any) {
          console.error('Error creating session:', e);
          setError(e.message || 'Could not initialize game session in database.');
          setCreating(false);
        }
      };

      initGame();
    }
  }, [dispatch, pin, creating, authChecked]);

  // Load custom quizzes from Firestore
  useEffect(() => {
    const loadQuizzes = async () => {
      try {
        const snapshot = await safeGet(safeRef('quizzes'));
        if (snapshot.exists()) {
          const val = snapshot.val();
          if (val) {
            const dbList = Object.keys(val).map(key => ({
              ...val[key],
              id: key
            }));
            setCustomQuizzes(dbList);
          }
        }
      } catch (e) {
        console.error('Failed to load custom quizzes from Firebase:', e);
      }
    };

    loadQuizzes();
  }, []);

  const handleQuizSelect = async (quizId: string) => {
    setSelectedQuizId(quizId);
    let selectedQuestions = mockQuestions;
    if (quizId !== 'default') {
      const found = customQuizzes.find((q) => q.id === quizId);
      if (found && found.questions) {
        selectedQuestions = found.questions;
      }
    }
    dispatch(setQuestions(selectedQuestions));
    if (pin) {
      try {
        await setDoc(doc(firestore, 'game_sessions', pin), {
          selectedQuizId: quizId,
          questions: selectedQuestions,
          totalQuestions: selectedQuestions.length,
        }, { merge: true });
      } catch (err) {
        console.error('Failed to sync quiz choices to session:', err);
      }
    }
  };

  // Listen to live player joins from Firestore subcollection
  useEffect(() => {
    if (!pin) return;

    const unsubscribe = onSnapshot(collection(firestore, 'game_sessions', pin, 'players'), (snapshot) => {
      const playersList: string[] = [];
      const playerObjects: any[] = [];
      snapshot.forEach((d) => {
        const pData = d.data();
        playersList.push(pData.nickname);
        playerObjects.push({
          nickname: pData.nickname,
          score: pData.score || 0,
          streak: pData.streak || 0,
          rank: pData.rank || 1,
        });
      });
      setLocalPlayers(playersList);
      dispatch(setPlayers(playerObjects));
    });

    return () => unsubscribe();
  }, [pin, dispatch]);

  const handleStartGame = async () => {
    if (localPlayers.length === 0 || !pin) return;
    setLoading(true);

    try {
      // Transition host state and view in Firestore
      await setDoc(doc(firestore, 'game_sessions', pin), {
        status: 'question',
        currentQuestionIndex: 0,
        questionStartTime: Date.now(),
        showResults: false,
      }, { merge: true });

      dispatch(setCurrentQuestionIndex(0));
      dispatch(setStatus('question'));
      navigate('/a/host/question');
    } catch (e: any) {
      console.error('Error starting game session:', e);
      setError(e.message || 'Failed to start game session');
      setLoading(false);
    }
  };

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <p style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-secondary)' }}>
          Verifying credentials...
        </p>
      </div>
    );
  }

  return (
    <div className="minimalist-container">
      <HostNavigationRail />

      <main className="minimalist-main" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Header bar */}
        <header className="minimalist-header">
          <div>
            <h1 style={{ fontSize: '2.5rem', textTransform: 'uppercase' }}>Session Lobby</h1>
            <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Waiting for participants to join the lobby</p>
          </div>
          <button
            onClick={handleStartGame}
            disabled={localPlayers.length === 0 || loading || !pin}
            className="minimalist-button minimalist-button-primary"
            style={{
              padding: '12px 28px',
              fontFamily: 'var(--font-title)',
              fontSize: '1rem',
              borderRadius: '6px',
            }}
          >
            <Play size={18} fill="currentColor" /> {loading ? 'Launching...' : 'Start Game'}
          </button>
        </header>

        {error && (
          <div style={{ padding: '12px', backgroundColor: 'var(--color-red)', color: 'white', fontWeight: 700, borderRadius: '6px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* Info grids */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px', flexGrow: 1 }}>
          {/* PIN Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div
              onClick={handleCopyPin}
              className="minimalist-card"
              style={{
                textAlign: 'center',
                backgroundColor: 'var(--bg-secondary)',
                border: '2px solid var(--text-primary)',
                padding: '32px 16px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                userSelect: 'none',
              }}
              title="Click to copy game PIN"
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: copied ? '#22c55e' : 'var(--text-secondary)', transition: 'color 0.2s ease' }}>
                {copied ? 'Copied Shareable Link!' : creating ? 'Creating Game...' : 'Click to Copy Share Link'}
              </span>
              <div
                style={{
                  fontFamily: 'var(--font-title)',
                  fontSize: '3.5rem',
                  fontWeight: 900,
                  letterSpacing: '2px',
                  margin: '8px 0 2px 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                }}
              >
                {pin || '......'}
                <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {copied ? (
                    <Check size={20} style={{ color: '#22c55e' }} className="animate-pop-in" />
                  ) : (
                    <Copy size={20} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
                  )}
                </div>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-blue)', fontWeight: 700, wordBreak: 'break-all', display: 'block', marginBottom: '8px' }}>
                valquiz.oqens.me/?pin={pin || '......'}
              </span>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Share this link or PIN code with players to join!
              </p>
            </div>

            {/* Quiz Selector Card */}
            <div
              className="minimalist-card"
              style={{
                border: '2px solid var(--text-primary)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Active Quiz
              </span>
              <select
                value={selectedQuizId}
                onChange={(e) => handleQuizSelect(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid var(--text-primary)',
                  borderRadius: '4px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="default">Default: Valkey Optimization Quiz</option>
                {customQuizzes.map((q) => (
                  <option key={q.id} value={q.id}>{q.title}</option>
                ))}
              </select>
            </div>

            {/* QR Mock code */}
            <div
              className="minimalist-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--text-primary)',
                height: '180px',
                backgroundColor: 'white',
              }}
            >
              {/* Geometric pattern simulating a QR Code */}
              <div
                style={{
                  width: '120px',
                  height: '120px',
                  border: '8px solid black',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gridGap: '6px',
                  padding: '4px',
                }}
              >
                <div style={{ backgroundColor: 'black' }} />
                <div style={{ backgroundColor: 'white' }} />
                <div style={{ backgroundColor: 'black' }} />
                <div style={{ backgroundColor: 'white' }} />
                <div style={{ backgroundColor: 'black' }} />
                <div style={{ backgroundColor: 'white' }} />
                <div style={{ backgroundColor: 'black' }} />
                <div style={{ backgroundColor: 'black' }} />
                <div style={{ backgroundColor: 'black' }} />
              </div>
            </div>
          </div>

          {/* Roster Card */}
          <div
            className="minimalist-card"
            style={{
              border: '2px solid var(--text-primary)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '2px solid var(--text-primary)',
                paddingBottom: '12px',
                marginBottom: '16px',
              }}
            >
              <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} /> Participant Roster
              </h3>
              <span
                style={{
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                  padding: '2px 10px',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                }}
              >
                {localPlayers.length} Active
              </span>
            </div>

            {localPlayers.length === 0 ? (
              <div
                style={{
                  flexGrow: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  gap: '12px',
                }}
              >
                <AlertCircle size={32} />
                <p style={{ fontWeight: 600 }}>No players joined yet. Share the PIN code above!</p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '12px',
                  alignContent: 'flex-start',
                  flexGrow: 1,
                  overflowY: 'auto',
                }}
              >
                {localPlayers.map((player, index) => (
                  <div
                    key={index}
                    className="animate-pop-in"
                    style={{
                      padding: '10px 16px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1.5px solid var(--text-primary)',
                      borderRadius: '4px',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {player}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const mockQuestions: Question[] = [
  {
    id: 'q1',
    sort_order: 1,
    type: 'mcq' as const,
    text: 'Which data structure is typically used for real-time leaderboards in Valkey?',
    options: [
      { id: 'A', text: 'Valkey Sorted Sets (ZSET)' },
      { id: 'B', text: 'Valkey Hash' },
      { id: 'C', text: 'Valkey HyperLogLog' },
      { id: 'D', text: 'Valkey Pub/Sub Channels' },
    ],
    correct: ['A'],
    timeLimit: 15,
  },
  {
    id: 'q2',
    sort_order: 2,
    type: 'mcq' as const,
    text: 'How does Valkey compare to Redis?',
    options: [
      { id: 'A', text: 'Valkey is closed-source' },
      { id: 'B', text: 'Valkey is a Linux Foundation open-source fork of Redis' },
      { id: 'C', text: 'Valkey only supports SQL syntax' },
      { id: 'D', text: 'Valkey is written in Python' },
    ],
    correct: ['B'],
    timeLimit: 15,
  },
];

export default HostLobby;
