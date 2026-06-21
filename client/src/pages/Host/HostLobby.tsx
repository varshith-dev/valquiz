import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../../store';
import { setPin, setQuestions, setStatus, setPlayers } from '../../store/gameSlice';
import HostNavigationRail from '../../components/Navigation/HostNavigationRail';
import socketService from '../../services/socket';
import useSocket from '../../hooks/useSocket';
import { Users, Play, AlertCircle, Copy, Check } from 'lucide-react';

export const HostLobby: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { pin, questions } = useSelector((state: RootState) => state.game);
  const [localPlayers, setLocalPlayers] = useState<string[]>(['ValkeyBot_1', 'SpeedRunner', 'QuizMaster']);
  const [loading, setLoading] = useState(false);

  const [customQuizzes, setCustomQuizzes] = useState<any[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('default');
  const [copied, setCopied] = useState(false);

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

  useEffect(() => {
    // Generate unique 6-digit game PIN on mount if not already present
    if (!pin) {
      const activeGamesRaw = localStorage.getItem('valquiz_active_games');
      let activeGames: string[] = [];
      if (activeGamesRaw) {
        try {
          activeGames = JSON.parse(activeGamesRaw);
        } catch (e) {
          console.error('Failed to parse active games', e);
        }
      }

      let generatedPin = '';
      do {
        generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
      } while (activeGames.includes(generatedPin));

      dispatch(setPin(generatedPin));
      
      // Scrape/Initialize mock questions into state for frontend standalone gameplay
      dispatch(setQuestions(mockQuestions));

      // Connect socket as host room
      socketService.connect(generatedPin, 'HOST');
    }
  }, [dispatch, pin]);

  // Synchronize pin and questions to localStorage for player lookup (respective pin to respective game)
  useEffect(() => {
    if (pin) {
      // 1. Add PIN to active games registry if not already there
      const activeGamesRaw = localStorage.getItem('valquiz_active_games');
      let activeGames: string[] = [];
      if (activeGamesRaw) {
        try {
          activeGames = JSON.parse(activeGamesRaw);
        } catch (e) {}
      }
      if (!activeGames.includes(pin)) {
        activeGames.push(pin);
        localStorage.setItem('valquiz_active_games', JSON.stringify(activeGames));
      }

      // 2. Update/Save the session details with questions
      localStorage.setItem(
        `valquiz_game_session_${pin}`,
        JSON.stringify({
          pin,
          questions,
          updatedAt: Date.now()
        })
      );
    }
  }, [pin, questions]);

  // Load local quizzes from localStorage
  useEffect(() => {
    const raw = localStorage.getItem('valquiz_custom_quizzes');
    if (raw) {
      try {
        setCustomQuizzes(JSON.parse(raw));
      } catch (e) {
        console.error('Failed to parse custom quizzes', e);
      }
    }
  }, []);

  const handleQuizSelect = (quizId: string) => {
    setSelectedQuizId(quizId);
    if (quizId === 'default') {
      dispatch(setQuestions(mockQuestions));
    } else {
      const found = customQuizzes.find((q) => q.id === quizId);
      if (found) {
        dispatch(setQuestions(found.questions));
      }
    }
  };

  // Listen to new socket player joins
  useSocket('player:joined', (player: any) => {
    const nick = player.nickname;
    if (nick && !localPlayers.includes(nick)) {
      const updated = [...localPlayers, nick];
      setLocalPlayers(updated);
      
      // Update Redux state
      const playerObjects = updated.map((name, i) => ({
        nickname: name,
        score: 0,
        streak: 0,
        rank: i + 1,
      }));
      dispatch(setPlayers(playerObjects));
    }
  });

  const handleStartGame = () => {
    if (localPlayers.length === 0) return;
    setLoading(true);
    
    // Notify all connected sockets that game is starting
    socketService.emit('game:start-session', { pin });

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
            disabled={localPlayers.length === 0 || loading}
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
                {copied ? 'Copied to Clipboard!' : 'Game PIN Code'}
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
                {pin}
                <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {copied ? (
                    <Check size={20} style={{ color: '#22c55e' }} className="animate-pop-in" />
                  ) : (
                    <Copy size={20} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
                  )}
                </div>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Scan QR Code or visit <strong>valquiz.it</strong> to join
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
                <p style={{ fontWeight: 600 }}>No players joined yet. Open player clients to join!</p>
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

const mockQuestions = [
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
    time_limit: 15,
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
    time_limit: 15,
  },
];

export default HostLobby;
