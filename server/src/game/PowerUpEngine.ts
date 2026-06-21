import { getValkey } from '../config/env.js';
import type { PowerUpType } from '../types/index.js';

const POWERUP_DURATIONS: Record<PowerUpType, number> = {
  freeze: 5000,  // 5 seconds freeze
  double: 0,     // activates instantly on next answer
  skip: 0,       // activates instantly - auto-correct
};

interface ActivePowerUp {
  type: PowerUpType;
  source: string;
  target?: string;
  expiresAt: number;
}

export class PowerUpEngine {
  // ─── Use a Power-Up ──────────────────────────────────
  static async usePowerUp(
    pin: string,
    nickname: string,
    type: PowerUpType,
    target?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const v = await getValkey();
    const playerKey = `game:${pin}:players`;
    const playerRaw = await v.hGet(playerKey, nickname);
    if (!playerRaw) return { success: false, error: 'Player not found' };

    const player = JSON.parse(playerRaw);
    const powerUpIndex = player.powerUps.indexOf(type);
    if (powerUpIndex === -1) return { success: false, error: `${type} power-up not available` };

    // Remove used power-up from player's inventory
    player.powerUps.splice(powerUpIndex, 1);
    await v.hSet(playerKey, nickname, JSON.stringify(player));

    if (type === 'freeze') {
      if (!target) return { success: false, error: 'Target required for freeze' };
      const targetRaw = await v.hGet(playerKey, target);
      if (!targetRaw) return { success: false, error: 'Target player not found' };

      // Store freeze effect in Valkey
      const freeze: ActivePowerUp = {
        type: 'freeze',
        source: nickname,
        target,
        expiresAt: Date.now() + POWERUP_DURATIONS.freeze,
      };
      await v.setEx(`game:${pin}:powerup:freeze:${target}`, 10, JSON.stringify(freeze));
    }

    if (type === 'double') {
      // Mark player for double points on next correct answer
      await v.setEx(`game:${pin}:powerup:double:${nickname}`, 3600, '1');
    }

    if (type === 'skip') {
      // Mark player for auto-correct on next question
      await v.setEx(`game:${pin}:powerup:skip:${nickname}`, 3600, '1');
    }

    return { success: true };
  }

  // ─── Check if Player is Frozen ───────────────────────
  static async isFrozen(pin: string, nickname: string): Promise<boolean> {
    const v = await getValkey();
    const freeze = await v.get(`game:${pin}:powerup:freeze:${nickname}`);
    if (!freeze) return false;

    const data: ActivePowerUp = JSON.parse(freeze);
    if (Date.now() > data.expiresAt) {
      await v.del(`game:${pin}:powerup:freeze:${nickname}`);
      return false;
    }
    return true;
  }

  // ─── Check if Double Points is Active ────────────────
  static async hasDoublePoints(pin: string, nickname: string): Promise<boolean> {
    const v = await getValkey();
    const result = await v.get(`game:${pin}:powerup:double:${nickname}`);
    if (result) {
      await v.del(`game:${pin}:powerup:double:${nickname}`);
      return true;
    }
    return false;
  }

  // ─── Check if Skip is Active ─────────────────────────
  static async hasSkip(pin: string, nickname: string): Promise<boolean> {
    const v = await getValkey();
    const result = await v.get(`game:${pin}:powerup:skip:${nickname}`);
    if (result) {
      await v.del(`game:${pin}:powerup:skip:${nickname}`);
      return true;
    }
    return false;
  }

  // ─── Get Active Freeze Effects on All Players ────────
  static async getActiveFreezes(pin: string): Promise<ActivePowerUp[]> {
    const v = await getValkey();
    const keys = await v.keys(`game:${pin}:powerup:freeze:*`);
    const freezes: ActivePowerUp[] = [];
    
    for (const key of keys) {
      const raw = await v.get(key);
      if (raw) {
        const data: ActivePowerUp = JSON.parse(raw);
        if (Date.now() < data.expiresAt) {
          freezes.push(data);
        }
      }
    }
    return freezes;
  }
}
