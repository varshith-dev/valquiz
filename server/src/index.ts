import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { env, getValkey, closeValkey } from './config/env.js';
import { registerSocketHandlers } from './socket/handlers.js';
import quizRoutes from './routes/quizRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';

async function main() {
  // ─── Express Setup ──────────────────────────────────
  const app = express();
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '10mb' }));

  // Request logger
  app.use((req, _res, next) => {
    console.log(`➡️ [REST] ${req.method} ${req.path}`);
    next();
  });

  // ─── HTTP Server ─────────────────────────────────────
  const httpServer = createServer(app);

  // ─── Socket.io Setup ────────────────────────────────
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
    pingInterval: 5000,        // Detect disconnects faster (was 10000)
    pingTimeout: 3000,         // Faster timeout (was 5000)
    transports: ['websocket', 'polling'], // Prefer WebSocket
    allowUpgrades: true,
    perMessageDeflate: false,  // Disable compression for lower latency
  });

  // ─── Routes ──────────────────────────────────────────
  app.use('/api', quizRoutes);
  app.use('/api', uploadRoutes);

  // ─── Serve static frontend if available ─────────────
  app.use(express.static('../client/dist', { fallthrough: true }));
  app.use(express.static('../host/dist', { fallthrough: true }));

  // ─── Socket Handlers ────────────────────────────────
  registerSocketHandlers(io);

  // ─── Start Server ────────────────────────────────────
  try {
    await getValkey();
    console.log('⚡ Valkey connected');
  } catch (err) {
    console.error('❌ Failed to connect to Valkey. Make sure it is running on port 6379.');
    console.error('   Run: docker run -d --name valquiz-valkey -p 6379:6379 valkey/valkey:8.0-alpine');
    process.exit(1);
  }

  httpServer.listen(env.PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║           🎮 ValQuiz Server v1.0            ║
║     Running on http://localhost:${env.PORT}        ║
║  REST API   → http://localhost:${env.PORT}/api     ║
║  WebSocket  → ws://localhost:${env.PORT}          ║
║  Health     → http://localhost:${env.PORT}/api/health ║
╚══════════════════════════════════════════════╝
    `);
  });

  // ─── Graceful Shutdown ──────────────────────────────
  const shutdown = async () => {
    console.log('\n🛑 Shutting down...');
    io.close();
    await closeValkey();
    httpServer.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
