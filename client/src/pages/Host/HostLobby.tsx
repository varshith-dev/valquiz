import React, { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../../store';
import { setPin, setQuestions, setStatus, setPlayers } from '../../store/gameSlice';
import HostNavigationRail from '../../components/Navigation/HostNavigationRail';
import socketService from '../../services/socket';
import useSocket from '../../hooks/useSocket';
import supabase from '../../services/supabase';
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

  // Authentication check on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const isPlaceholder = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder-url');
        if (!session && !isPlaceholder) {
          navigate('/host/login');
        }
      } catch (err) {
        console.warn('Supabase session check error, bypassing...', err);
      }
    };
    checkAuth();
  }, [navigate]);

  const handleCopyPin = () => {
    if (pin) {
      navigator.clipboard.writeText(pin).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch((err) => {
        console.error('Failed to copy PIN to clipboard', err);
      });
    }
  };

  // Connect socket and create game on mount
  useEffect(() => {
    if (!pin && !creating) {
      setCreating(true);

      // Connect to socket server
      socketService.connect();

      // Wait for connection then create game
      const tryCreate = () => {
        if (socketService.socket?.connected) {
          socketService.emit('host:create', { nickname: 'HOST' }, (res: any) => {
            if (res.error) {
              setError(res.error);
              setCreating(false);
              return;
            }
            dispatch(setPin(res.pin));
            sessionStorage.setItem('valquiz_pin', res.pin);

            // Load default questions into the server
            dispatch(setQuestions(mockQuestions));
            loadQuestionsToServer(res.pin, mockQuestions);
            setCreating(false);
          });
        } else {
          // Wait and retry
          setTimeout(tryCreate, 300);
        }
      };

      // Small delay to let socket connect
      setTimeout(tryCreate, 500);
    }
  }, [dispatch, pin, creating]);

  const loadQuestionsToServer = (gamePin: string, qs: Question[]) => {
    socketService.emit('host:load-questions', { pin: gamePin, questions: qs }, (res: any) => {
      if (!res.success) {
        console.error('Failed to load questions:', res.error);
        setError('Failed to load questions to server');
      } else {
        console.log('✅ Questions loaded to server');
      }
    });
  };

  // Load local quizzes from localStorage AND server
  useEffect(() => {
    // 1. Local storage quizzes
    const raw = localStorage.getItem('valquiz_custom_quizzes');
    let localList: any[] = [];
    if (raw) {
      try {
        localList = JSON.parse(raw);
      } catch (e) {
        console.error('Failed to parse custom quizzes', e);
      }
    }

    // 2. Fetch server quizzes
    fetch('/api/quiz')
      .then(res => res.json())
      .then(data => {
        const serverQuizzes = data.quizzes || [];
        // Combine them, avoiding duplicates
        const combined = [...localList];
        serverQuizzes.forEach((sq: any) => {
          if (!combined.some(cq => cq.id === sq.id)) {
            combined.push(sq);
          }
        });
        setCustomQuizzes(combined);
      })
      .catch(err => {
        console.error('Error fetching server quizzes:', err);
        setCustomQuizzes(localList); // fallback to local only
      });
  }, []);

  const handleQuizSelect = (quizId: string) => {
    setSelectedQuizId(quizId);
    if (quizId === 'default') {
      dispatch(setQuestions(mockQuestions));
      if (pin) {
        loadQuestionsToServer(pin, mockQuestions);
      }
    } else {
      const found = customQuizzes.find((q) => q.id === quizId);
      if (found) {
        if (found.questions) {
          dispatch(setQuestions(found.questions));
          if (pin) {
            loadQuestionsToServer(pin, found.questions);
          }
        } else {
          // Fetch from server details
          fetch(`/api/quiz/${quizId}`)
            .then(res => res.json())
            .then(data => {
              if (data.quiz && data.quiz.questions) {
                dispatch(setQuestions(data.quiz.questions));
                if (pin) {
                  loadQuestionsToServer(pin, data.quiz.questions);
                }
              }
            })
            .catch(err => {
              console.error('Error fetching quiz details:', err);
              setError('Failed to load selected quiz details from server');
            });
        }
      }
    }
  };

  // Listen to new socket player joins
  const handlePlayerJoined = useCallback((data: any) => {
    const nick = data.nickname;
    if (nick) {
      setLocalPlayers(prev => {
        if (prev.includes(nick)) return prev;
        const updated = [...prev, nick];
        // Update Redux state
        const playerObjects = updated.map((name, i) => ({
          nickname: name,
          score: 0,
          streak: 0,
          rank: i + 1,
        }));
        dispatch(setPlayers(playerObjects));
        return updated;
      });
    }
  }, [dispatch]);
  useSocket('player:joined', handlePlayerJoined);

  // Listen for player leaving
  const handlePlayerLeft = useCallback((data: any) => {
    const nick = data.nickname;
    if (nick) {
      setLocalPlayers(prev => {
        const updated = prev.filter(p => p !== nick);
        const playerObjects = updated.map((name, i) => ({
          nickname: name,
          score: 0,
          streak: 0,
          rank: i + 1,
        }));
        dispatch(setPlayers(playerObjects));
        return updated;
      });
    }
  }, [dispatch]);
  useSocket('player:left', handlePlayerLeft);

  const handleStartGame = () => {
    if (localPlayers.length === 0 || !pin) return;
    setLoading(true);

    // Tell server to start the game
    socketService.emit('host:start', { pin });

    // Transition host state and view
    setTimeout(() => {
      dispatch(setStatus('question'));
      navigate('/host/question');
    }, 1000);
  };

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
                {copied ? 'Copied to Clipboard!' : creating ? 'Creating Game...' : 'Game PIN Code'}
              </span>
              <div
                style={{
                  fontFamily: 'var(--font-title)',
                  fontSize: '3rem',
                  fontWeight: 900,
                  letterSpacing: '2px',
                  margin: '12px 0',
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
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Share this PIN with players to join
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
