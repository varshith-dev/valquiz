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

    // ─── Host: Load Questions ──────────────────────────
    socket.on('host:load-questions', async (data, callback) => {
      try {
        const { pin, questions } = data;
        const session = socketMap.get(socket.id);
        if (session?.role !== 'host') {
          callback({ success: false, error: 'Only host can load questions' });
          return;
        }

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
          callback({ success: false, error: 'No questions provided' });
          return;
        }

        // Normalize question timeLimit field
        const normalized = questions.map((q: any, idx: number) => ({
          id: q.id || `q${idx + 1}`,
          text: q.text,
          type: q.type || 'mcq',
          options: q.options || [],
          correct: Array.isArray(q.correct) ? q.correct : [q.correct],
          timeLimit: q.timeLimit || q.time_limit || 20,
          explanation: q.explanation || '',
          hint: q.hint || '',
          media_url: q.media_url || '',
          pairs: q.pairs || [],
        }));

        await GameManager.setQuestions(pin, normalized);
        callback({ success: true });
        console.log(`📋 Loaded ${normalized.length} questions into game ${pin}`);
      } catch (err: any) {
        callback({ success: false, error: err.message });
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
        socket.join(`player:${pin}:${nickname}`);

        // Get current player list for the callback
        const allPlayers = await GameManager.getPlayers(pin);
        const playerNames = allPlayers.map(p => p.nickname);

        // Notify host and all players in the lobby
        const playerCount = allPlayers.length;
        io.to(`game:${pin}`).emit('player:joined', { nickname, playerCount });

        callback({ success: true, players: playerNames });
        console.log(`👤 Player ${nickname} joined game ${pin}`);
      } catch (err: any) {
        callback({ success: false, error: err.message });
      }
    });

    // ─── Player: Submit Answer (New — replaces Firestore write) ──────
    socket.on('player:submit-answer', async (data, callback) => {
      try {
        const { pin, qIndex, answerIds, responseTimeMs } = data;
        const session = socketMap.get(socket.id);
        if (!session?.nickname) {
          callback({ success: false, error: 'Not in a game' });
          return;
        }

        // Store answer in Valkey
        const stored = await GameManager.storeAnswer(pin, qIndex, session.nickname, answerIds, responseTimeMs);
        if (!stored) {
          callback({ success: false, error: 'Already answered' });
          return;
        }

        // Get updated count and broadcast to host
        const count = await GameManager.getAnswerCount(pin, qIndex);
        io.to(`host:${pin}`).emit('answer:count', { count });

        // Broadcast updated distribution to host
        const distribution = await GameManager.getAnswerDistribution(pin, qIndex);
        io.to(`host:${pin}`).emit('answer:distribution', { distribution });

        callback({ success: true });
      } catch (err: any) {
        console.error('Submit answer error:', err);
        callback({ success: false, error: err.message });
      }
    });

    // ─── Legacy Player: Submit Answer (keep for backward compat) ─────
    socket.on('player:answer', async (data) => {
      try {
        const { pin, qIndex, answerIds, responseTimeMs } = data;
        const session = socketMap.get(socket.id);
        if (!session?.nickname) return;

        // Store answer in Valkey
        await GameManager.storeAnswer(pin, qIndex, session.nickname, answerIds, responseTimeMs);

        // Get updated count and broadcast to host
        const count = await GameManager.getAnswerCount(pin, qIndex);
        io.to(`host:${pin}`).emit('answer:count', { count });

        // Broadcast updated distribution to host
        const distribution = await GameManager.getAnswerDistribution(pin, qIndex);
        io.to(`host:${pin}`).emit('answer:distribution', { distribution });
      } catch (err) {
        console.error('Answer error:', err);
      }
    });

    // ─── Host: Start Game ───────────────────────────────
    socket.on('host:start', async (data) => {
      try {
        const { pin, questions } = data;
        const session = socketMap.get(socket.id);
        if (session?.role !== 'host') return;

        const game = await GameManager.getGame(pin);
        if (!game) return;

        // If questions provided, load them first
        if (questions && Array.isArray(questions) && questions.length > 0) {
          const normalized = questions.map((q: any, idx: number) => ({
            id: q.id || `q${idx + 1}`,
            text: q.text,
            type: q.type || 'mcq',
            options: q.options || [],
            correct: Array.isArray(q.correct) ? q.correct : [q.correct],
            timeLimit: q.timeLimit || q.time_limit || 20,
            explanation: q.explanation || '',
            hint: q.hint || '',
            media_url: q.media_url || '',
            pairs: q.pairs || [],
          }));
          await GameManager.setQuestions(pin, normalized);
        }

        const loadedQuestions = await GameManager.getQuestions(pin);
        if (loadedQuestions.length === 0) {
          socket.emit('error', { message: 'No questions in game', code: 'NO_QUESTIONS' });
          return;
        }

        await GameManager.setStatus(pin, 'playing');
        const totalQuestions = loadedQuestions.length;

        // Broadcast game start
        io.to(`game:${pin}`).emit('game:start', { totalQuestions });

        // Send first question
        await sendQuestion(io, pin, 0);
      } catch (err) {
        console.error('Start error:', err);
      }
    });

    // ─── Host: End Question (New — replaces Firestore status write) ──
    socket.on('host:end-question', async (data) => {
      try {
        const { pin } = data;
        const session = socketMap.get(socket.id);
        if (session?.role !== 'host') return;

        const game = await GameManager.getGame(pin);
        if (!game) return;

        const qIndex = game.currentQuestion;
        const distribution = await GameManager.getAnswerDistribution(pin, qIndex);

        // Broadcast to all clients that question has ended
        io.to(`game:${pin}`).emit('question:ended', { distribution });
        console.log(`⏹️ Question ${qIndex} ended in game ${pin}`);
      } catch (err) {
        console.error('End question error:', err);
      }
    });

    // ─── Host: Reveal Answer (New — replaces Firestore + scoring) ────
    socket.on('host:reveal-answer', async (data) => {
      try {
        const { pin } = data;
        const session = socketMap.get(socket.id);
        if (session?.role !== 'host') return;

        const game = await GameManager.getGame(pin);
        if (!game) return;

        const qIndex = game.currentQuestion;
        const questions = await GameManager.getQuestions(pin);
        const question = questions[qIndex];
        if (!question) return;

        // Calculate scores for all players
        const answers = await GameManager.getAnswers(pin, qIndex);
        const allPlayers = await GameManager.getPlayers(pin);

        for (const player of allPlayers) {
          const answer = answers[player.nickname];
          let correct = false;
          let responseTimeMs = 0;

          if (answer) {
            responseTimeMs = answer.responseTimeMs || 0;
            const isCorrectSorted = [...question.correct].sort().join(',');
            const playerSorted = [...answer.answerIds].sort().join(',');
            correct = isCorrectSorted === playerSorted;
          }

          // Check for skip power-up (auto-correct)
          const hasSkip = await PowerUpEngine.hasSkip(pin, player.nickname);
          const finalCorrect = hasSkip ? true : correct;

          // Check if frozen
          const frozen = await PowerUpEngine.isFrozen(pin, player.nickname);

          // Calculate score
          const { pointsEarned, streak } = frozen
            ? { pointsEarned: 0, streak: 0 }
            : await ScoringEngine.calculateScore(
                pin,
                player.nickname,
                qIndex,
                finalCorrect,
                responseTimeMs,
                game.mode,
              );

          // Check for double points power-up
          const hasDouble = await PowerUpEngine.hasDoublePoints(pin, player.nickname);
          const finalPoints = hasDouble ? pointsEarned * 2 : pointsEarned;
          if (hasDouble && pointsEarned > 0) {
            const v = await (await import('../config/env.js')).getValkey();
            await v.zIncrBy(`game:${pin}:leaderboard`, pointsEarned, player.nickname);
          }

          // Get updated stats
          const leaderboard = await ScoringEngine.getLeaderboard(pin);
          const myEntry = leaderboard.find(e => e.nickname === player.nickname);

          // Send individual score update to the player
          io.to(`player:${pin}:${player.nickname}`).emit('score:update', {
            nickname: player.nickname,
            score: myEntry?.score || 0,
            streak: myEntry?.streak || 0,
            rank: myEntry?.rank || 0,
            correct: finalCorrect,
            pointsEarned: finalPoints,
          });
        }

        // Get final leaderboard and distribution
        const leaderboard = await ScoringEngine.getLeaderboard(pin);
        const distribution = await GameManager.getAnswerDistribution(pin, qIndex);

        // Broadcast answer reveal to all
        io.to(`game:${pin}`).emit('answer:reveal', {
          correct: question.correct as string[],
          distribution,
          leaderboard,
        });

        console.log(`✅ Answer revealed for Q${qIndex} in game ${pin}`);
      } catch (err) {
        console.error('Reveal answer error:', err);
      }
    });

    // ─── Host: Go to Leaderboard (New) ──────────────────
    socket.on('host:go-leaderboard', async (data) => {
      try {
        const { pin } = data;
        const session = socketMap.get(socket.id);
        if (session?.role !== 'host') return;

        const leaderboard = await ScoringEngine.getLeaderboard(pin);
        io.to(`game:${pin}`).emit('game:go-leaderboard', { leaderboard });
        console.log(`📊 Leaderboard shown for game ${pin}`);
      } catch (err) {
        console.error('Go leaderboard error:', err);
      }
    });

    // ─── Host: Next Question (New — replaces Firestore answer cleanup) ─
    socket.on('host:next-question', async (data, callback) => {
      try {
        const { pin } = data;
        const session = socketMap.get(socket.id);
        if (session?.role !== 'host') {
          callback({ success: false, error: 'Not a host' });
          return;
        }

        const game = await GameManager.getGame(pin);
        if (!game) {
          callback({ success: false, error: 'Game not found' });
          return;
        }

        // Clear answers from the current question
        await GameManager.clearAnswers(pin, game.currentQuestion);

        const qIndex = await GameManager.advanceQuestion(pin);
        const questions = await GameManager.getQuestions(pin);

        if (qIndex >= questions.length) {
          // Game finished
          await GameManager.setStatus(pin, 'podium');
          const finalLeaderboard = await ScoringEngine.getLeaderboard(pin);
          const top3 = finalLeaderboard.slice(0, 3);
          io.to(`game:${pin}`).emit('game:finished', { finalLeaderboard });
          io.to(`game:${pin}`).emit('podium:reveal', { top3 });
          callback({ success: true, finished: true });
          return;
        }

        await sendQuestion(io, pin, qIndex);
        callback({ success: true });
      } catch (err: any) {
        console.error('Next question error:', err);
        callback({ success: false, error: err.message });
      }
    });

    // ─── Host: Reveal Hint (New) ────────────────────────
    socket.on('host:reveal-hint', async (data) => {
      try {
        const { pin } = data;
        const session = socketMap.get(socket.id);
        if (session?.role !== 'host') return;

        const game = await GameManager.getGame(pin);
        if (!game) return;

        await GameManager.setHintRevealed(pin, game.currentQuestion, true);
        io.to(`game:${pin}`).emit('hint:revealed', { qIndex: game.currentQuestion });
        console.log(`💡 Hint revealed for Q${game.currentQuestion} in game ${pin}`);
      } catch (err) {
        console.error('Reveal hint error:', err);
      }
    });

    // ─── Host: Next Question (Legacy) ────────────────────
    socket.on('host:next', async (data) => {
      try {
        const { pin } = data;
        const session = socketMap.get(socket.id);
        if (session?.role !== 'host') return;

        const game = await GameManager.getGame(pin);
        if (!game) return;

        // Clear answers from current question
        await GameManager.clearAnswers(pin, game.currentQuestion);

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

    // ─── Game State Sync (for reconnection) ──────────────
    socket.on('game:request-sync', async (data) => {
      try {
        const { pin, nickname, role } = data;
        let session = socketMap.get(socket.id);
        if (!session) {
          session = { role: (role === 'host' ? 'host' : 'player') };
          socketMap.set(socket.id, session);
        }
        const activeSession = session;
        if (role === 'host' || role === 'player') activeSession.role = role;
        if (pin) activeSession.pin = pin;
        if (nickname) activeSession.nickname = nickname;

        if (pin) {
          socket.join(`game:${pin}`);
          if (activeSession.role === 'host') {
            socket.join(`host:${pin}`);
            console.log(`🔌 Host re-associated with socket ${socket.id} for game ${pin}`);
          } else if (activeSession.role === 'player' && nickname) {
            socket.join(`player:${pin}:${nickname}`);
            await GameManager.updatePlayerSocket(pin, nickname, socket.id);
            console.log(`🔌 Player ${nickname} re-associated with socket ${socket.id} for game ${pin}`);
          }
        }

        const game = await GameManager.getGame(pin);
        if (!game) return;

        const questions = await GameManager.getQuestions(pin);
        const qIndex = game.currentQuestion;
        const question = questions[qIndex];
        const allPlayers = await GameManager.getPlayers(pin);
        const leaderboard = await ScoringEngine.getLeaderboard(pin);
        const isHintRevealed = await GameManager.isHintRevealed(pin, qIndex);

        // Check if this player has already answered
        let hasAnswered = false;
        if (activeSession.nickname) {
          const answers = await GameManager.getAnswers(pin, qIndex);
          hasAnswered = !!answers[activeSession.nickname];
        }

        const answerCount = await GameManager.getAnswerCount(pin, qIndex);
        const distribution = await GameManager.getAnswerDistribution(pin, qIndex);

        // Calculate secondsLeft if game is in playing status
        let secondsLeft: number | undefined = undefined;
        if (game.status === 'playing' && question) {
          const v = await (await import('../config/env.js')).getValkey();
          const questionStartTimeRaw = await v.hGet(`game:${pin}:config`, 'questionStartTime');
          const questionStartTime = questionStartTimeRaw ? parseInt(questionStartTimeRaw, 10) : game.createdAt;
          const limit = question.timeLimit || (question as any).time_limit || 20;
          const elapsedMs = Date.now() - questionStartTime;
          const elapsedSeconds = Math.floor(elapsedMs / 1000);
          secondsLeft = Math.max(0, limit - elapsedSeconds);
        }

        socket.emit('game:state-sync', {
          pin,
          status: game.status,
          qIndex,
          question: question ? {
            text: question.text,
            options: question.options,
            timeLimit: secondsLeft !== undefined ? secondsLeft : (question.timeLimit || 20),
            type: (question as any).type,
            hint: (question as any).hint,
            media_url: (question as any).media_url,
            pairs: (question as any).pairs,
          } : undefined,
          players: allPlayers.map(p => p.nickname),
          leaderboard,
          isHintRevealed,
          hasAnswered,
          answerCount,
          distribution,
          questions: activeSession.role === 'host' ? questions : undefined,
        });
      } catch (err) {
        console.error('State sync error:', err);
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
            io.to(`player:${pin}:${target}`).emit('powerup:effect', {
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
        // Also broadcast to all players so lobby lists stay in sync
        io.to(`game:${session.pin}`).emit('player:left', {
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

  // Store the current question's start time in Valkey config
  try {
    const v = await (await import('../config/env.js')).getValkey();
    await v.hSet(`game:${pin}:config`, 'questionStartTime', Date.now().toString());
  } catch (err) {
    console.error('Failed to set questionStartTime in Valkey:', err);
  }

  // Send to players (without correct answer)
  io.to(`game:${pin}`).emit('question:new', {
    qIndex,
    text: question.text,
    options: question.options,
    timeLimit: question.timeLimit,
    type: (question as any).type || 'mcq',
    hint: (question as any).hint || '',
    media_url: (question as any).media_url || '',
    pairs: (question as any).pairs || [],
  });

  // Send to host (with correct answer)
  io.to(`host:${pin}`).emit('question:host', {
    qIndex,
    text: question.text,
    options: question.options,
    timeLimit: question.timeLimit,
    correct: question.correct as string[],
    type: (question as any).type || 'mcq',
    hint: (question as any).hint || '',
    media_url: (question as any).media_url || '',
    pairs: (question as any).pairs || [],
  });
}
