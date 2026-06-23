import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../../store';
import { setStatus, setPin } from '../../store/gameSlice';
import { setNickname } from '../../store/playerSlice';
import { safeSignInAnonymously } from '../../services/firebase';
import socketService from '../../services/socket';
import { Check, AlertCircle } from 'lucide-react';

export const PlayerLobby: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { pin } = useSelector((state: RootState) => state.game);
  const { nickname } = useSelector((state: RootState) => state.player);

  const [dots, setDots] = useState('.');
  
  // Nickname entry states
  const [inputName, setInputName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    safeSignInAnonymously().catch((err) => {
      console.error('Anonymous sign-in failed in lobby:', err);
    });
  }, []);

  // Players in the lobby (populated by Firestore)
  const [lobbyPlayers, setLobbyPlayers] = useState<string[]>([]);

  // Handle window width resize to make bubble offsets responsive
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  // Restore pin/nickname if page was refreshed
  useEffect(() => {
    const storedPin = sessionStorage.getItem('valquiz_pin');
    const storedNickname = sessionStorage.getItem('valquiz_nickname');

    if (storedPin && !pin) {
      dispatch(setPin(storedPin));
    }
    if (storedNickname && !nickname) {
      dispatch(setNickname(storedNickname));
    }
  }, [dispatch, pin, nickname]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '.' : d + '.'));
    }, 600);
    return () => clearInterval(interval);
  }, []);

  // Listen to game status, joins, leaves and sync states from Socket.IO
  useEffect(() => {
    const activePin = pin || sessionStorage.getItem('valquiz_pin');
    if (!activePin) return;

    socketService.connect();

    if (!nickname) return;

    const handleJoined = (data: any) => {
      const { nickname: joinedName } = data;
      setLobbyPlayers((prev) => {
        if (prev.includes(joinedName)) return prev;
        return [...prev, joinedName];
      });
    };

    const handleLeft = (data: any) => {
      const { nickname: leftName } = data;
      setLobbyPlayers((prev) => prev.filter((p) => p !== leftName));
    };

    const handleStart = () => {
      dispatch(setStatus('question'));
      navigate('/player/question');
    };

    const handleStateSync = (data: any) => {
      if (data.players) {
        setLobbyPlayers(data.players);
      }
      if (data.status === 'playing') {
        dispatch(setStatus('question'));
        navigate('/player/question');
      }
    };

    const handleConnect = () => {
      socketService.emit('game:request-sync', { pin: activePin, nickname, role: 'player' });
    };

    socketService.on('player:joined', handleJoined);
    socketService.on('player:left', handleLeft);
    socketService.on('game:start', handleStart);
    socketService.on('game:state-sync', handleStateSync);
    socketService.on('connect', handleConnect);

    // Request initial sync to sync state
    if (socketService.isConnected()) {
      socketService.emit('game:request-sync', { pin: activePin, nickname, role: 'player' });
    }

    return () => {
      socketService.off('player:joined');
      socketService.off('player:left');
      socketService.off('game:start');
      socketService.off('game:state-sync');
      socketService.off('connect', handleConnect);
    };
  }, [pin, nickname, dispatch, navigate]);

  const handleNicknameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputName.trim();

    if (!trimmed || trimmed.length < 2) {
      setError('Nickname must be at least 2 characters');
      return;
    }

    setError('');
    setLoading(true);

    const activePin = pin || sessionStorage.getItem('valquiz_pin') || '';

    socketService.connect();
    socketService.emit('player:join', { pin: activePin, nickname: trimmed }, (res: any) => {
      if (res && res.success) {
        dispatch(setNickname(trimmed));
        sessionStorage.setItem('valquiz_nickname', trimmed);
        if (res.players) {
          setLobbyPlayers(res.players);
        }
        setLoading(false);
      } else {
        setError(res?.error || 'Failed to join game session.');
        setLoading(false);
      }
    });
  };

  // Concentric ellipse layer-wise layout centered in the viewport container
  const getBubblePosition = (index: number, total: number) => {
    if (index === 0) return { x: 0, y: 0 };

    let remaining = index - 1;
    let layer = 1;
    let layerCapacity = 5;

    while (remaining >= layerCapacity) {
      remaining -= layerCapacity;
      layer++;
      layerCapacity = layer * 5;
    }

    let totalInThisLayer = 0;
    let tempRemaining = total - 1;
    let currentLayer = 1;

    while (tempRemaining > 0) {
      const cap = currentLayer * 5;
      if (currentLayer === layer) {
        totalInThisLayer = Math.min(tempRemaining, cap);
        break;
      }
      tempRemaining -= cap;
      currentLayer++;
    }

    const horizontalScale = isMobile ? 1.75 : 1.7;
    const verticalScale = isMobile ? 0.95 : 0.85;

    let ringDistance = isMobile ? 80 : 105;
    
    if (total > 6) {
      const compression = Math.max(0.8, 1 - (total - 6) * 0.015);
      ringDistance *= compression;
    }

    const radius = layer * ringDistance;
    const countInLayer = totalInThisLayer || layerCapacity;
    
    const angleIncrement = (2 * Math.PI) / countInLayer;
    const staggerOffset = (layer * 36 * Math.PI) / 180;
    const angle = remaining * angleIncrement + staggerOffset;

    return {
      x: radius * Math.cos(angle) * horizontalScale,
      y: radius * Math.sin(angle) * verticalScale,
    };
  };

  // 1. NICKNAME SELECTION STATE (If name is not set yet)
  if (!nickname) {
    return (
      <div className="brutalist-container">
        <div className="brutalist-card" style={{ width: '100%', maxWidth: '440px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.75rem', textTransform: 'uppercase' }}>
              Choose Roster Name
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', marginTop: '6px' }}>
              Room PIN: {pin || '000000'} • Choose a unique name
            </p>
          </div>

          {error && (
            <div
              style={{
                padding: '12px',
                border: '3px solid var(--text-primary)',
                backgroundColor: 'var(--color-red)',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.85rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleNicknameSubmit}>
            <label className="brutalist-label">Choose Nickname</label>
            <input
              type="text"
              placeholder="e.g. MasterQuiz"
              value={inputName}
              onChange={(e) => setInputName(e.target.value.slice(0, 16))}
              className="brutalist-input"
              disabled={loading}
              autoFocus
            />
            <button
              type="submit"
              className="brutalist-button brutalist-button-green"
              disabled={loading}
              style={{ marginTop: '8px' }}
            >
              {loading ? 'Joining...' : 'Confirm Nickname'} <Check size={18} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. ACTIVE LOBBY WAITING STATE (If name is successfully configured)
  const allJoinedPlayers = lobbyPlayers.includes(nickname) ? lobbyPlayers : [nickname, ...lobbyPlayers];

  const handleQuit = () => {
    socketService.disconnect();
    dispatch(setNickname(''));
    sessionStorage.removeItem('valquiz_pin');
    sessionStorage.removeItem('valquiz_nickname');
    navigate('/');
  };

  return (
    <div 
      style={{
        padding: '32px 24px',
        maxWidth: '1200px',
        margin: '0 auto',
        minHeight: '100vh',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Top Header: PIN & Small Quit Button */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
          borderBottom: '3px solid var(--border-color)',
          paddingBottom: '16px'
        }}
      >
        <span 
          style={{
            fontFamily: 'var(--font-title)',
            fontWeight: 900,
            fontSize: '1.5rem',
            letterSpacing: '0.5px'
          }}
        >
          ROOM PIN: {pin || '000000'}
        </span>
        <button
          onClick={handleQuit}
          className="brutalist-button"
          style={{
            width: 'auto',
            padding: '8px 16px',
            fontSize: '0.85rem',
            fontWeight: 800,
            backgroundColor: 'var(--color-red)',
            color: 'white',
            boxShadow: '3px 3px 0px var(--text-primary)',
            border: '2px solid var(--text-primary)'
          }}
        >
          QUIT
        </button>
      </div>

      {/* Waiting Status */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <p style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Waiting for the host to start{dots}
        </p>
      </div>

      {/* Joined Players Pool Cloud - Borderless & Starting from Center */}
      <div 
        style={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          width: '100%'
        }}
      >
        <div 
          style={{ 
            fontSize: '0.95rem', 
            fontWeight: 850, 
            textTransform: 'uppercase', 
            marginBottom: '16px', 
            borderBottom: '2px solid var(--border-color)', 
            paddingBottom: '10px',
            color: 'var(--text-secondary)'
          }}
        >
          Joined Pool ({allJoinedPlayers.length})
        </div>
        
        {/* Dynamic Bubble Canvas */}
        <div 
          style={{ 
            position: 'relative',
            width: '100%',
            minHeight: isMobile ? '360px' : '500px',
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'visible',
            boxSizing: 'border-box'
          }}
        >
          {allJoinedPlayers.map((player, index) => {
            const { x, y } = getBubblePosition(index, allJoinedPlayers.length);
            const isSelf = player === nickname;
            return (
              <div 
                key={player}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  zIndex: isSelf ? 10 : 1,
                  pointerEvents: 'auto',
                  transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
              >
                <div 
                  className="animate-bubble-pop"
                  style={{
                    fontSize: isMobile ? '0.85rem' : '0.95rem',
                    fontWeight: 800,
                    padding: isMobile ? '10px 18px' : '14px 24px',
                    borderRadius: '9999px',
                    backgroundColor: isSelf 
                      ? 'var(--color-yellow)' 
                      : 'var(--bg-secondary)',
                    color: isSelf 
                      ? '#272320' 
                      : 'var(--text-primary)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.04)',
                    border: '1.5px solid var(--border-color)',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: isMobile ? '130px' : '160px',
                    boxSizing: 'border-box',
                    userSelect: 'none',
                    transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease'
                  }}
                  title={player}
                >
                  {player}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlayerLobby;
