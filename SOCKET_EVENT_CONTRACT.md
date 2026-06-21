# 🎮 ValQuiz Socket Event Contract

## For Frontend Collaborators (client/ + host/)

### Connection
```ts
import { io } from 'socket.io-client';
const socket = io('http://localhost:3000');
```

---

## 📡 Server → Client Events

### General (both client and host)

| Event | Payload | When |
|---|---|---|
| `leaderboard:update` | `{ leaderboard: [{ nickname, score, streak, rank }] }` | After any answer |
| `game:start` | `{ totalQuestions: number }` | Host starts game |
| `game:finished` | `{ finalLeaderboard: [...] }` | Game ends |
| `podium:reveal` | `{ top3: [{ nickname, score, streak, rank }] }` | Show podium |
| `error` | `{ message: string, code: string }` | Something went wrong |

### Player Events (client/)

| Event | Payload | When |
|---|---|---|
| `question:new` | `{ qIndex, text, options: [{id, text}], timeLimit }` | New question |
| `answer:result` | `{ correct, correctAnswer[], pointsEarned, streak, responseTimeMs }` | After submitting |
| `powerup:effect` | `{ type: 'freeze'|'double'|'skip', expiresIn: number }` | Power-up affects you |
| `powerup:activated` | `{ type, target?, source }` | Someone used power-up |

### Host Events (host/)

| Event | Payload | When |
|---|---|---|
| `game:created` | `{ pin: string, hostId: string }` | After host:create |
| `player:joined` | `{ nickname, playerCount }` | Player joins |
| `player:left` | `{ nickname, playerCount }` | Player leaves |
| `question:host` | `{ qIndex, text, options, timeLimit, correct[] }` | Question + answer |
| `projector:data` | `{ qIndex, answerDistribution: {}, leaderboard }` | For projector view |

---

## 📤 Client → Server Events

### Player (client/)

| Event | Payload | Notes |
|---|---|---|
| `player:join` | `{ pin, nickname, fingerprint? }` | Callback: `{ success, error? }` |
| `player:answer` | `{ pin, qIndex, answerIds[], responseTimeMs }` | answerIds = ["A"] or ["A","C"] |
| `powerup:use` | `{ pin, type: 'freeze'|'double'|'skip', target? }` | target only for freeze |
| `ping` | `{ timestamp }` | Latency measurement |

### Host (host/)

| Event | Payload | Notes |
|---|---|---|
| `host:create` | `{ nickname }` | Callback: `{ pin, hostId, error? }` |
| `host:start` | `{ pin }` | Starts game (needs questions loaded) |
| `host:next` | `{ pin }` | Advances to next question |
| `host:end` | `{ pin }` | Ends game early |

---

## 🌐 REST API Endpoints

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/api/health` | — | `{ status, service, version }` |
| `POST` | `/api/quiz/generate` | `{ topic, numQuestions?, difficulty? }` | `{ success, topic, questions[], generatedCount }` |
| `POST` | `/api/quiz/generate-from-text` | `{ text, numQuestions? }` | `{ success, questions[], generatedCount }` |
| `POST` | `/api/quiz` | `{ title, questions[] }` | `{ success, quiz }` |
| `GET` | `/api/quiz` | — | `{ quizzes: [{id, title, createdAt}] }` |
| `GET` | `/api/quiz/:id` | — | `{ quiz }` |
| `GET` | `/api/game/:pin` | — | `{ game, playerCount }` |

---

## 🎨 Frontend Structure

```
valquiz/
├── client/     # Player-facing (join, answer, feedback, podium)
│   └── src/
│       ├── pages/JoinGame.tsx
│       ├── pages/PlayerLobby.tsx
│       ├── pages/PlayerQuestion.tsx
│       ├── pages/PlayerFeedback.tsx
│       └── pages/PlayerPodium.tsx
│
├── host/       # Host + Projector
│   └── src/
│       ├── pages/HostDashboard.tsx
│       ├── pages/HostLobby.tsx
│       ├── pages/HostQuestion.tsx
│       ├── pages/HostLeaderboard.tsx
│       └── pages/ProjectorView.tsx
│
└── server/     # Backend (this)
```

**Both client/ and host/ connect to:** `http://localhost:3000` (REST + WebSocket)
