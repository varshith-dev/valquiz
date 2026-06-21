import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { LayoutDashboard, PlusCircle, History, Settings, LogOut } from 'lucide-react';
import type { RootState } from '../../store';
import { resetGame } from '../../store/gameSlice';

export const HostNavigationRail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { pin } = useSelector((state: RootState) => state.game);

  const menuItems = [
    { icon: <LayoutDashboard size={22} />, path: '/host', label: 'Dashboard' },
    { icon: <PlusCircle size={22} />, path: '/create', label: 'Create' },
    { icon: <History size={22} />, path: '/history', label: 'History' },
    { icon: <Settings size={22} />, path: '/settings', label: 'Settings' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: 'var(--nav-rail-width)',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '2px solid var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 0',
        zIndex: 100,
        gap: '32px',
      }}
    >
      {/* Brand Icon / Logo */}
      <div
        onClick={() => navigate('/')}
        style={{
          width: '48px',
          height: '48px',
          backgroundColor: 'var(--text-primary)',
          color: 'var(--bg-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '10px',
          fontWeight: 800,
          fontSize: '1.25rem',
          cursor: 'pointer',
          fontFamily: 'var(--font-title)',
        }}
        title="ValQuiz Home"
      >
        VQ
      </div>

      {/* Primary Navigation Icons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, width: '100%', alignItems: 'center' }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                width: '48px',
                height: '48px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: isActive ? 'var(--color-brand)' : 'var(--text-primary)',
                backgroundColor: isActive ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
              }}
              title={item.label}
            >
              {item.icon}
              <span style={{ fontSize: '9px', fontWeight: 600, marginTop: '2px' }}>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Exit Button */}
      <button
        onClick={() => {
          if (pin) {
            localStorage.removeItem(`valquiz_game_session_${pin}`);
            const activeGamesRaw = localStorage.getItem('valquiz_active_games');
            if (activeGamesRaw) {
              try {
                const activeGames = JSON.parse(activeGamesRaw);
                const updated = activeGames.filter((p: string) => p !== pin);
                localStorage.setItem('valquiz_active_games', JSON.stringify(updated));
              } catch (e) {
                console.error('Failed to cleanup active game PIN', e);
              }
            }
          }
          dispatch(resetGame());
          navigate('/');
        }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          width: '48px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-accent)',
          borderRadius: '8px',
        }}
        title="Exit Host Dashboard"
      >
        <LogOut size={22} />
      </button>
    </div>
  );
};

export default HostNavigationRail;
