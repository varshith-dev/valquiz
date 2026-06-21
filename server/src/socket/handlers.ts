import type { Server, Socket } from 'socket.io';
import { GameManager } from '../game/GameManager.js';
import { ScoringEngine } from '../game/ScoringEngine.js';
import { AntiBotGuard } from '../game/AntiBotGuard.js';
import { PowerUpEngine } from '../game/PowerUpEngine.js';
import type { ServerToClientEvents, ClientToServerEvents, Question } from '../types/index.js';

// In-memory mapping: socketId → { pin, nickname, role }
const socketMap = new Map<string, { pin?: string; nickname?: string; role: 'host' | 'player' }>();

export function registerSocketHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>): void {
  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
    socketMap.set(socket.id, { role: 'player' });

    // ─── Host: Create Game ──────────────────────────────
    socket.on('host:create', async (data, callback) => {
      try {
        const { nickname } = data;
        const game = await GameManager.createGame(socket.id, 'classic');
        socketMap.set(socket.id, { pin: game.pin, nickname, role: 'host' });
        socket.join(`game:${game.pin}`);
        socket.join(`host:${game.pin}`);
        callback({ pin: game.pin, hostId: socket.id });
        console.log(`🎯 Host ${nickname} created game ${game.pin}`);
      } catch (err: any) {
        callback({ error: err.message });
      }
    });

    // ─── Player: Join Game ──────────────────────────────
    socket.on('player:join', async (data, callback) => {
      try {
        const { pin, nickname, fingerprint } = data;

        // Validate PIN
        if (!AntiBotGuard.validatePin(pin)) {
          callback({ success: false, error: 'Invalid PIN format' });
          return;
        }

        // Check game exists
        const game = await GameManager.getGame(pin);
        if (!game || game.status !== 'lobby') {
          callback({ success: false, error: 'Game not found or already started' });
          return;
        }

        // Validate nickname
        const nickError = AntiBotGuard.validateNickname(nickname);
        if (nickError) {
          callback({ success: false, error: nickError });
          return;
        }

        // Rate limit
        const ip = socket.handshake.address || 'unknown';
        const allowed = await AntiBotGuard.checkRateLimit(ip);
        if (!allowed) {
          callback({ success: false, error: 'Too many join attempts. Wait a moment.' });
          return;
        }

        // Fingerprint check (if provided)
        if (fingerprint) {
          const unique = await AntiBotGuard.checkFingerprint(pin, fingerprint);
          if (!unique) {
            callback({ success: false, error: 'Device already joined this game' });
            return;
          }
        }

        // Add player
        const added = await GameManager.addPlayer(pin, nickname, socket.id, fingerprint);
        if (!added) {
          callback({ success: false, error: 'Nickname already taken in this game' });
          return;
        }

        socketMap.set(socket.id, { pin, nickname, role: 'player' });
        socket.join(`game:${pin}`);
        socket.join(`player:${nickname}`);

        // Notify host
        const playerCount = await GameManager.getPlayerCount(pin);
        io.to(`host:${pin}`).emit('player:joined', { nickname, playerCount });

        callback({ success: true });
        console.log(`👤 Player ${nickname} joined game ${pin}`);
      } catch (err: any) {
        callback({ success: false, error: err.message });
      }
    });

    // ─── Player: Submit Answer ──────────────────────────
    socket.on('player:answer', async (data) => {
      try {
        const { pin, qIndex, answerIds, responseTimeMs } = data;
        const session = socketMap.get(socket.id);
        if (!session?.nickname) return;

        const game = await GameManager.getGame(pin);
        if (!game) return;

        // Check if frozen
        const frozen = await PowerUpEngine.isFrozen(pin, session.nickname);
        if (frozen) {
          socket.emit('answer:result', {
            correct: false,
            correctAnswer: [],
            pointsEarned: 0,
            streak: 0,
            responseTimeMs,
          });
          return;
        }

        // Get questions
        const questions = await GameManager.getQuestions(pin);
        const question = questions[qIndex];
        if (!question) return;

        // Check answer
        const isCorrect = JSON.stringify(answerIds.sort()) === JSON.stringify([...question.correct].sort());

        // Check for skip power-up (auto-correct)
        const hasSkip = await PowerUpEngine.hasSkip(pin, session.nickname);
        const finalCorrect = hasSkip ? true : isCorrect;

        // Calculate score
        const { pointsEarned, streak } = await ScoringEngine.calculateScore(
          pin,
          session.nickname,
          qIndex,
          finalCorrect,
          responseTimeMs,
          game.mode,
        );

        // Check for double points power-up
        const hasDouble = await PowerUpEngine.hasDoublePoints(pin, session.nickname);
        const finalPoints = hasDouble ? pointsEarned * 2 : pointsEarned;

        // If doubled, update leaderboard with extra points
        if (hasDouble) {
          const v = await (await import('../config/env.js')).getValkey();
          await v.zIncrBy(`game:${pin}:leaderboard`, pointsEarned, session.nickname);
        }

        // Send result to player
        socket.emit('answer:result', {
          correct: finalCorrect,
          correctAnswer: question.correct as string[],
          pointsEarned: finalPoints,
          streak,
          responseTimeMs,
        });

        // Broadcast leaderboard to all
        const leaderboard = await ScoringEngine.getLeaderboard(pin);
        io.to(`game:${pin}`).emit('leaderboard:update', { leaderboard });

        // Send projector data
        io.to(`host:${pin}`).emit('projector:data', {
          qIndex,
          answerDistribution: {},
          leaderboard,
        });
      } catch (err) {
        console.error('Answer error:', err);
      }
    });

    // ─── Host: Start Game ───────────────────────────────
    socket.on('host:start', async (data) => {
      try {
        const { pin } = data;
        const session = socketMap.get(socket.id);
        if (session?.role !== 'host') return;

        const game = await GameManager.getGame(pin);
        if (!game) return;

        const questions = await GameManager.getQuestions(pin);
        if (questions.length === 0) {
          socket.emit('error', { message: 'No questions in game', code: 'NO_QUESTIONS' });
          return;
        }

        await GameManager.setStatus(pin, 'playing');
        const totalQuestions = questions.length;

        // Broadcast game start
        io.to(`game:${pin}`).emit('game:start', { totalQuestions });

        // Send first question
        await sendQuestion(io, pin, 0);
      } catch (err) {
        console.error('Start error:', err);
      }
    });

    // ─── Host: Next Question ────────────────────────────
    socket.on('host:next', async (data) => {
      try {
        const { pin } = data;
        const session = socketMap.get(socket.id);
        if (session?.role !== 'host') return;

        const qIndex = await GameManager.advanceQuestion(pin);
        const questions = await GameManager.getQuestions(pin);

        if (qIndex >= questions.length) {
          // Game finished
          await GameManager.setStatus(pin, 'podium');
          const finalLeaderboard = await ScoringEngine.getLeaderboard(pin);
          const top3 = finalLeaderboard.slice(0, 3);
          io.to(`game:${pin}`).emit('game:finished', { finalLeaderboard });
          io.to(`game:${pin}`).emit('podium:reveal', { top3 });
          return;
        }

        await sendQuestion(io, pin, qIndex);
      } catch (err) {
        console.error('Next question error:', err);
      }
    });

    // ─── Host: End Game ─────────────────────────────────
    socket.on('host:end', async (data) => {
      try {
        const { pin } = data;
        await GameManager.setStatus(pin, 'finished');
        const finalLeaderboard = await ScoringEngine.getLeaderboard(pin);
        io.to(`game:${pin}`).emit('game:finished', { finalLeaderboard });
      } catch (err) {
        console.error('End game error:', err);
      }
    });

    // ─── Power-Up ────────────────────────────────────────
    socket.on('powerup:use', async (data) => {
      try {
        const { pin, type, target } = data;
        const session = socketMap.get(socket.id);
        if (!session?.nickname) return;

        const result = await PowerUpEngine.usePowerUp(pin, session.nickname, type, target);
        if (result.success) {
          io.to(`game:${pin}`).emit('powerup:activated', {
            type,
            target,
            source: session.nickname,
          });
          if (target && type === 'freeze') {
            io.to(`player:${target}`).emit('powerup:effect', {
              type: 'freeze',
              expiresIn: 5000,
            });
          }
        } else {
          socket.emit('error', { message: result.error || 'Power-up failed', code: 'POWERUP_FAILED' });
        }
      } catch (err) {
        console.error('Power-up error:', err);
      }
    });

    // ─── Latency Ping ──────────────────────────────────
    socket.on('ping', (data) => {
      socket.emit('pong' as any, { timestamp: data.timestamp, serverTime: Date.now() });
    });

    // ─── Disconnect ─────────────────────────────────────
    socket.on('disconnect', async () => {
      const session = socketMap.get(socket.id);
      if (session?.pin && session.nickname && session.role === 'player') {
        await GameManager.removePlayer(session.pin, session.nickname);
        const playerCount = await GameManager.getPlayerCount(session.pin);
        io.to(`host:${session.pin}`).emit('player:left', {
          nickname: session.nickname,
          playerCount,
        });
        console.log(`🚪 Player ${session.nickname} left game ${session.pin}`);
      }
      socketMap.delete(socket.id);
    });
  });
}

// ─── Helper: Send Question ────────────────────────────
async function sendQuestion(
  io: Server,
  pin: string,
  qIndex: number,
): Promise<void> {
  const [game, questions] = await Promise.all([
    GameManager.getGame(pin),
    GameManager.getQuestions(pin),
  ]);
  if (!game) return;

  const question = questions[qIndex];
  if (!question) return;

  // Send to players (without correct answer)
  io.to(`game:${pin}`).emit('question:new', {
    qIndex,
    text: question.text,
    options: question.options,
    timeLimit: question.timeLimit,
  });

  // Send to host (with correct answer)
  io.to(`host:${pin}`).emit('question:host', {
    qIndex,
    text: question.text,
    options: question.options,
    timeLimit: question.timeLimit,
    correct: question.correct as string[],
  });
}
