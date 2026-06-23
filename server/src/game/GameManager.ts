import { v4 as uuidv4 } from 'uuid';
import { getValkey } from '../config/env.js';
import type { GameConfig, GameStatus, Player, Question, PowerUpType } from '../types/index.js';

const GAME_TTL = 7200; // 2 hours

export class GameManager {
  // ─── Create Game ──────────────────────────────────────
  static async createGame(hostId: string, mode: string = 'classic'): Promise<GameConfig> {
    const v = await getValkey();
    const pin = await GameManager.generatePin();
    const config: GameConfig = {
      pin,
      hostId,
      status: 'lobby',
      mode: mode as GameConfig['mode'],
      currentQuestion: 0,
      totalQuestions: 0,
      createdAt: Date.now(),
    };

    await v.hSet(`game:${pin}:config`, config as unknown as Record<string, string>);
    await v.expire(`game:${pin}:config`, GAME_TTL);
    console.log(`🎮 Game created: ${pin}`);
    return config;
  }

  // ─── Generate Unique 6-digit PIN ──────────────────────
  private static async generatePin(): Promise<string> {
    const v = await getValkey();
    let pin: string;
    let attempts = 0;
    do {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
      attempts++;
      if (attempts > 50) throw new Error('Could not generate unique PIN');
    } while (await v.exists(`game:${pin}:config`));
    return pin;
  }

  // ─── Get Game Config ──────────────────────────────────
  static async getGame(pin: string): Promise<GameConfig | null> {
    const v = await getValkey();
    const raw = await v.hGetAll(`game:${pin}:config`);
    if (!raw || !raw.pin) return null;
    return {
      pin: raw.pin,
      hostId: raw.hostId,
      status: raw.status as GameStatus,
      mode: raw.mode as GameConfig['mode'],
      currentQuestion: parseInt(raw.currentQuestion || '0', 10),
      totalQuestions: parseInt(raw.totalQuestions || '0', 10),
      createdAt: parseInt(raw.createdAt || '0', 10),
    };
  }

  // ─── Update Game Status ───────────────────────────────
  static async setStatus(pin: string, status: GameStatus): Promise<void> {
    const v = await getValkey();
    await v.hSet(`game:${pin}:config`, 'status', status);
  }

  // ─── Set Questions for Game ──────────────────────────
  static async setQuestions(pin: string, questions: Question[]): Promise<void> {
    const v = await getValkey();
    await v.set(`game:${pin}:questions`, JSON.stringify(questions));
    await v.expire(`game:${pin}:questions`, GAME_TTL);
    await v.hSet(`game:${pin}:config`, 'totalQuestions', questions.length.toString());
  }

  // ─── Get Questions ────────────────────────────────────
  static async getQuestions(pin: string): Promise<Question[]> {
    const v = await getValkey();
    const raw = await v.get(`game:${pin}:questions`);
    return raw ? JSON.parse(raw) : [];
  }

  // ─── Advance Question ────────────────────────────────
  static async advanceQuestion(pin: string): Promise<number> {
    const v = await getValkey();
    const game = await GameManager.getGame(pin);
    if (!game) throw new Error('Game not found');
    const nextQ = game.currentQuestion + 1;
    await v.hSet(`game:${pin}:config`, 'currentQuestion', nextQ.toString());
    return nextQ;
  }

  // ─── Player Join ──────────────────────────────────────
  static async addPlayer(pin: string, nickname: string, socketId: string, fingerprint?: string): Promise<boolean> {
    const v = await getValkey();
    const exists = await v.hExists(`game:${pin}:players`, nickname);
    if (exists) return false;

    const player: Player = {
      nickname,
      socketId,
      joinedAt: Date.now(),
      fingerprint,
      powerUps: ['freeze', 'double', 'skip'], // Each player gets all power-ups once
    };

    await v.hSet(`game:${pin}:players`, nickname, JSON.stringify(player));
    await v.expire(`game:${pin}:players`, GAME_TTL);

    // Add to leaderboard with score 0
    await v.zAdd(`game:${pin}:leaderboard`, { score: 0, value: nickname });
    await v.expire(`game:${pin}:leaderboard`, GAME_TTL);

    // Track streaks
    await v.hSet(`game:${pin}:streaks`, nickname, '0');
    await v.expire(`game:${pin}:streaks`, GAME_TTL);

    return true;
  }

  // ─── Remove Player ────────────────────────────────────
  static async removePlayer(pin: string, nickname: string): Promise<void> {
    const v = await getValkey();
    await v.hDel(`game:${pin}:players`, nickname);
    await v.zRem(`game:${pin}:leaderboard`, nickname);
    await v.hDel(`game:${pin}:streaks`, nickname);
  }

  // ─── Get Players Count ────────────────────────────────
  static async getPlayerCount(pin: string): Promise<number> {
    const v = await getValkey();
    return v.hLen(`game:${pin}:players`);
  }

  // ─── Get All Players ──────────────────────────────────
  static async getPlayers(pin: string): Promise<Player[]> {
    const v = await getValkey();
    const raw = await v.hGetAll(`game:${pin}:players`);
    return Object.values(raw).map((s) => JSON.parse(s as string));
  }

  // ─── Get Player by Nickname ──────────────────────────
  static async getPlayer(pin: string, nickname: string): Promise<Player | null> {
    const v = await getValkey();
    const raw = await v.hGet(`game:${pin}:players`, nickname);
    return raw ? JSON.parse(raw) : null;
  }

  // ─── Update Player Socket ─────────────────────────────
  static async updatePlayerSocket(pin: string, nickname: string, socketId: string): Promise<void> {
    const v = await getValkey();
    const player = await GameManager.getPlayer(pin, nickname);
    if (player) {
      player.socketId = socketId;
      await v.hSet(`game:${pin}:players`, nickname, JSON.stringify(player));
    }
  }

  // ─── Cleanup ───────────────────────────────────────────
  static async destroyGame(pin: string): Promise<void> {
    const v = await getValkey();
    const keys = await v.keys(`game:${pin}:*`);
    if (keys.length > 0) await v.del(keys);
    console.log(`🗑️ Game ${pin} destroyed`);
  }

  // ─── Store Player Answer ──────────────────────────────
  static async storeAnswer(
    pin: string,
    qIndex: number,
    nickname: string,
    answerIds: string[],
    responseTimeMs: number,
  ): Promise<boolean> {
    const v = await getValkey();
    const key = `game:${pin}:answers:${qIndex}`;
    const already = await v.hExists(key, nickname);
    if (already) return false; // Already answered
    await v.hSet(key, nickname, JSON.stringify({ answerIds, responseTimeMs, timestamp: Date.now() }));
    await v.expire(key, GAME_TTL);
    return true;
  }

  // ─── Get Answer Count ─────────────────────────────────
  static async getAnswerCount(pin: string, qIndex: number): Promise<number> {
    const v = await getValkey();
    return v.hLen(`game:${pin}:answers:${qIndex}`);
  }

  // ─── Get All Answers ──────────────────────────────────
  static async getAnswers(pin: string, qIndex: number): Promise<Record<string, { answerIds: string[]; responseTimeMs: number }>> {
    const v = await getValkey();
    const raw = await v.hGetAll(`game:${pin}:answers:${qIndex}`);
    const answers: Record<string, { answerIds: string[]; responseTimeMs: number }> = {};
    for (const [nickname, jsonStr] of Object.entries(raw)) {
      try {
        answers[nickname] = JSON.parse(jsonStr as string);
      } catch {}
    }
    return answers;
  }

  // ─── Get Answer Distribution ──────────────────────────
  static async getAnswerDistribution(pin: string, qIndex: number): Promise<Record<string, number>> {
    const answers = await GameManager.getAnswers(pin, qIndex);
    const distribution: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const answer of Object.values(answers)) {
      for (const id of answer.answerIds) {
        if (distribution[id] !== undefined) {
          distribution[id]++;
        }
      }
    }
    return distribution;
  }

  // ─── Clear Answers ────────────────────────────────────
  static async clearAnswers(pin: string, qIndex: number): Promise<void> {
    const v = await getValkey();
    await v.del(`game:${pin}:answers:${qIndex}`);
  }

  // ─── Hint State ───────────────────────────────────────
  static async setHintRevealed(pin: string, qIndex: number, revealed: boolean): Promise<void> {
    const v = await getValkey();
    await v.set(`game:${pin}:hint:${qIndex}`, revealed ? '1' : '0');
    await v.expire(`game:${pin}:hint:${qIndex}`, GAME_TTL);
  }

  static async isHintRevealed(pin: string, qIndex: number): Promise<boolean> {
    const v = await getValkey();
    const val = await v.get(`game:${pin}:hint:${qIndex}`);
    return val === '1';
  }
}

