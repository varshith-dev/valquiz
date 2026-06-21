# 🎮 ValQuiz — Real-Time Quiz Platform

> Built for **Build Beyond Limits 2.0 Hackathon**
> Valkey-powered, real-time quiz that fixes every major Kahoot flaw.

## ✨ What Makes ValQuiz Stand Out

| Feature | Why |
|---|---|
| **Real-time scoring** | Valkey Sorted Sets compute leaderboard in milliseconds |
| **Power-ups** | Freeze, 2x Points, Skip — "Kahoot meets Mario Kart" |
| **AI-generated quizzes** | Gemini API + Breeth memory → quizzes from any topic |
| **3 scoring modes** | Classic (speed-focused), Balanced (30% speed), Accuracy (correctness-only) |
| **Anti-bot guard** | Rate limiting + fingerprint dedup |
| **Projector mode** | Big-screen optimized view with live charts |
| **No Docker needed** | Runs with in-memory store, zero infrastructure |

## 🏗️ Architecture

```
valquiz/
├── server/              # Node.js + Express + Socket.io + Valkey
│   ├── src/
│   │   ├── index.ts     # Server entry point
│   │   ├── game/        # Game engine
│   │   │   ├── GameManager.ts      # PIN gen, lifecycle, players
│   │   │   ├── ScoringEngine.ts    # Latency-compensated scoring
│   │   │   ├── AntiBotGuard.ts     # Rate limiter + fingerprint
│   │   │   ├── PowerUpEngine.ts    # Freeze/2x/Skip power-ups
│   │   │   ├── AiGenerator.ts      # Gemini + Breeth integration
│   │   │   └── QuizFallback.ts     # Template fallback generator
│   │   ├── socket/
│   │   │   └── handlers.ts         # All Socket.io event handlers
│   │   ├── routes/
│   │   │   └── quizRoutes.ts       # REST API endpoints
│   │   └── config/
│   │       ├── env.ts              # Connection + fallback mock
│   │       └── ValkeyMock.ts       # In-memory Valkey (zero deps)
│   └── package.json
├── client/              # (your collaborator) Player frontend
├── host/                # (your collaborator) Host frontend
├── SOCKET_EVENT_CONTRACT.md   # Full socket API docs
└── README.md
```

## 🚀 Quick Start

### 1. Start the Server
```bash
cd server
npm install
npm run dev
```

Server starts at **http://localhost:3000** with:
- In-memory data store (no Docker/Valkey needed for development)
- Automatic fallback to Valkey/Redis if available on port 6379

### 2. Start the Frontend (for collaborators)

```bash
cd client   # or cd host
npm install
npm run dev
```

Both connect to `http://localhost:3000`.

> See [SOCKET_EVENT_CONTRACT.md](./SOCKET_EVENT_CONTRACT.md) for the complete event contract.

### 3. (Optional) Enable Valkey for Production

```bash
docker run -d --name valquiz-valkey -p 6379:6379 valkey/valkey:8.0-alpine
```

## 🌐 REST API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Server health check |
| `POST` | `/api/quiz/generate` | AI-generate quiz from topic |
| `POST` | `/api/quiz/generate-from-text` | Generate quiz from text |
| `POST` | `/api/quiz` | Save a quiz |
| `GET` | `/api/quiz` | List all quizzes |
| `GET` | `/api/quiz/:id` | Get quiz by ID |
| `GET` | `/api/game/:pin` | Get game state |

## 🔌 Socket Events

Full contract in [SOCKET_EVENT_CONTRACT.md](./SOCKET_EVENT_CONTRACT.md).

### Key events:
- `host:create` + `host:start` → Host creates & starts game
- `player:join` + `player:answer` → Player joins & answers
- `question:new` + `answer:result` → Game flow
- `leaderboard:update` + `podium:reveal` → Scoring
- `powerup:use` + `powerup:effect` → Power-ups

## 🛠️ Built With

- **Runtime**: Node.js 22 + TypeScript
- **Real-time**: Socket.io
- **Data Store**: Valkey / iovalkey (with in-memory fallback)
- **AI**: Gemini API + Breeth Memory Layer
- **Frontend**: React + Vite + TypeScript + Redux Toolkit

## 📋 Team Split

| Role | Responsibility |
|---|---|
| **Backend (You)** | `server/` — game engine, AI, API, sockets |
| **Collaborator** | `client/` — player join, play, podium |
| **Collaborator** | `host/` — dashboard, lobby, projector |
