import { getValkey } from '../config/env.js';

const RATE_LIMIT_WINDOW = 10; // seconds
const MAX_JOINS_PER_WINDOW = 5;

export class AntiBotGuard {
  // ─── Rate Limiting ────────────────────────────────────
  static async checkRateLimit(ip: string): Promise<boolean> {
    const v = await getValkey();
    const key = `rate:join:${ip}`;
    const count = await v.incr(key);
    
    if (count === 1) {
      await v.expire(key, RATE_LIMIT_WINDOW);
    }

    return count <= MAX_JOINS_PER_WINDOW;
  }

  // ─── Fingerprint Deduplication ────────────────────────
  static async checkFingerprint(pin: string, fingerprint: string): Promise<boolean> {
    const v = await getValkey();
    const key = `game:${pin}:fingerprints`;
    const isNew = await v.sAdd(key, fingerprint);
    await v.expire(key, 7200); // 2 hours
    return isNew === 1; // true if fingerprint wasn't already in set
  }

  // ─── Nickname Validation ──────────────────────────────
  static validateNickname(nickname: string): string | null {
    if (!nickname || nickname.trim().length < 2) {
      return 'Nickname must be at least 2 characters';
    }
    if (nickname.length > 20) {
      return 'Nickname must be 20 characters or less';
    }
    if (!/^[a-zA-Z0-9_ ]+$/.test(nickname)) {
      return 'Nickname can only contain letters, numbers, spaces, and underscores';
    }
    return null;
  }

  // ─── PIN Validation ───────────────────────────────────
  static validatePin(pin: string): boolean {
    return /^\d{6}$/.test(pin);
  }
}
