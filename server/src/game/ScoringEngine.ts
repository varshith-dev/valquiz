import { getValkey } from '../config/env.js';
import type { GameMode, LeaderboardEntry } from '../types/index.js';

interface ZRangeMember {
  value: string;
  score: number;
}

export class ScoringEngine {
  // ─── Calculate Score ──────────────────────────────────
  static async calculateScore(
    pin: string,
    nickname: string,
    qIndex: number,
    correct: boolean,
    responseTimeMs: number,
    mode: GameMode,
  ): Promise<{ pointsEarned: number; streak: number }> {
    if (!correct) {
      await ScoringEngine.resetStreak(pin, nickname);
      return { pointsEarned: 0, streak: 0 };
    }

    const streak = await ScoringEngine.incrementStreak(pin, nickname);
    const baseScore = ScoringEngine.getBaseScore(responseTimeMs, mode, true);
    const streakMultiplier = 1 + Math.min(streak - 1, 4) * 0.2; // max 2x at streak 5
    const points = Math.round(baseScore * streakMultiplier);

    // Add to leaderboard (Valkey Sorted Set)
    const v = await getValkey();
    await v.zIncrBy(`game:${pin}:leaderboard`, points, nickname);

    return { pointsEarned: points, streak };
  }

  // ─── Get Base Score Based on Response Time ────────────
  private static getBaseScore(responseTimeMs: number, mode: GameMode, wasCorrect: boolean): number {
    const maxTime = 20000; // 20s default
    const ratio = Math.max(0, 1 - responseTimeMs / maxTime);

    switch (mode) {
      case 'accuracy':
        return wasCorrect ? 1000 : 0;
      case 'balanced':
        return Math.round(300 + ratio * 700);
      case 'classic':
      default:
        return Math.round(ratio * 1000);
    }
  }

  // ─── Streak Management ────────────────────────────────
  private static async incrementStreak(pin: string, nickname: string): Promise<number> {
    const v = await getValkey();
    return v.hIncrBy(`game:${pin}:streaks`, nickname, 1);
  }

  private static async resetStreak(pin: string, nickname: string): Promise<void> {
    const v = await getValkey();
    await v.hSet(`game:${pin}:streaks`, nickname, '0');
  }

  // ─── Get Leaderboard ──────────────────────────────────
  static async getLeaderboard(pin: string): Promise<LeaderboardEntry[]> {
    const v = await getValkey();
    const results: ZRangeMember[] = await v.zRangeWithScores(`game:${pin}:leaderboard`, 0, -1, { rev: true });
    const streaksRecord: Record<string, string> = await v.hGetAll(`game:${pin}:streaks`);

    return results.map((item: ZRangeMember, index: number) => ({
      nickname: item.value,
      score: item.score,
      streak: parseInt(streaksRecord[item.value] || '0', 10),
      rank: index + 1,
    }));
  }

  // ─── Get Top 3 for Podium ─────────────────────────────
  static async getTop3(pin: string): Promise<LeaderboardEntry[]> {
    const lb = await ScoringEngine.getLeaderboard(pin);
    return lb.slice(0, 3);
  }
}
