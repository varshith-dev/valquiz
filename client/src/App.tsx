import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';

// Pages
import HomePage from './pages/Home/HomePage';
import JoinGame from './pages/Play/JoinGame';
import PlayerLobby from './pages/Play/PlayerLobby';
import PlayerQuestion from './pages/Play/PlayerQuestion';
import PlayerFeedback from './pages/Play/PlayerFeedback';
import PlayerPodium from './pages/Play/PlayerPodium';

import HostLogin from './pages/Host/HostLogin';
import HostLobby from './pages/Host/HostLobby';
import HostQuestion from './pages/Host/HostQuestion';
import HostLeaderboard from './pages/Host/HostLeaderboard';
import HostPodium from './pages/Host/HostPodium';


import CreateQuiz from './pages/Create/CreateQuiz';
import AIGenerate from './pages/Create/AIGenerate';

// Components
import AccessibilityBar from './components/common/AccessibilityBar';
import HostNavigationRail from './components/Navigation/HostNavigationRail';

// Mock History Page for complete navbar routing coverage
const MockHistory: React.FC = () => (
  <div className="minimalist-container">
    <HostNavigationRail />
    <main className="minimalist-main">
      <header className="minimalist-header">
        <div>
          <h1 style={{ fontSize: '2rem' }}>Session History</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Log of completed ValQuiz games</p>
        </div>
      </header>
      <div className="minimalist-card" style={{ border: '2px dashed var(--text-primary)', textAlign: 'center', padding: '40px' }}>
        <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No historical sessions recorded yet.</p>
      </div>
    </main>
  </div>
);

export const App: React.FC = () => {
  return (
    <Provider store={store}>
      <Router>
        <div style={{ minHeight: '100vh', position: 'relative' }}>
          <Routes>
            {/* General */}
            <Route path="/" element={<HomePage />} />

            {/* Player Flow */}
            <Route path="/play" element={<JoinGame />} />
            <Route path="/player/lobby" element={<PlayerLobby />} />
            <Route path="/player/question" element={<PlayerQuestion />} />
            <Route path="/player/feedback" element={<PlayerFeedback />} />
            <Route path="/player/podium" element={<PlayerPodium />} />

            {/* Host Flow */}
            <Route path="/a/host" element={<HostLobby />} />
            <Route path="/a/host/login" element={<HostLogin />} />
            <Route path="/a/host/question" element={<HostQuestion />} />
            <Route path="/a/host/leaderboard" element={<HostLeaderboard />} />
            <Route path="/a/host/podium" element={<HostPodium />} />

            {/* Creator / Admin Flow */}
            <Route path="/create" element={<CreateQuiz />} />
            <Route path="/history" element={<MockHistory />} />
            <Route path="/settings" element={<AIGenerate />} />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Floaters */}
          <AccessibilityBar />
        </div>
      </Router>
    </Provider>
  );
};

export default App;
