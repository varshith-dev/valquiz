// ─── Game Types ──────────────────────────────────────────

export type GameStatus = 'waiting' | 'lobby' | 'playing' | 'finished' | 'podium';
export type GameMode = 'classic' | 'balanced' | 'accuracy';
export type QuestionType = 'mcq' | 'truefalse';
export type PowerUpType = 'freeze' | 'double' | 'skip';

export interface GameConfig {
  pin: string;
  hostId: string;
  status: GameStatus;
  mode: GameMode;
  currentQuestion: number;
  totalQuestions: number;
  createdAt: number;
}

export interface Player {
  nickname: string;
  socketId: string;
  joinedAt: number;
  fingerprint?: string;
  latency?: number;
  powerUps: PowerUpType[];
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options: Option[];
  correct: string[];
  timeLimit: number;
  explanation?: string;
}

export interface Option {
  id: string;
  text: string;
}

export interface AnswerResult {
  correct: boolean;
  correctAnswer: string[];
  pointsEarned: number;
  streak: number;
  responseTimeMs: number;
}

export interface LeaderboardEntry {
  nickname: string;
  score: number;
  streak: number;
  rank: number;
}

export interface PowerUpState {
  type: PowerUpType;
  target?: string;
  source: string;
  expiresAt: number;
}

// ─── Socket Event Types ──────────────────────────────────

export interface ServerToClientEvents {
  'game:created': (data: { pin: string; hostId: string }) => void;
  'player:joined': (data: { nickname: string; playerCount: number }) => void;
  'player:left': (data: { nickname: string; playerCount: number }) => void;
  'game:start': (data: { totalQuestions: number }) => void;
  'question:new': (data: { qIndex: number; text: string; options: Option[]; timeLimit: number; type?: string; hint?: string; media_url?: string; pairs?: { left: string; right: string }[] }) => void;
  'question:host': (data: { qIndex: number; text: string; options: Option[]; timeLimit: number; correct?: string[]; type?: string; hint?: string; media_url?: string; pairs?: { left: string; right: string }[] }) => void;
  'question:ended': (data: { distribution: Record<string, number> }) => void;
  'answer:reveal': (data: { correct: string[]; distribution: Record<string, number>; leaderboard: LeaderboardEntry[] }) => void;
  'answer:result': (data: AnswerResult) => void;
  'answer:count': (data: { count: number }) => void;
  'answer:distribution': (data: { distribution: Record<string, number> }) => void;
  'hint:revealed': (data: { qIndex: number }) => void;
  'score:update': (data: { nickname: string; score: number; streak: number; rank: number; correct: boolean; pointsEarned: number }) => void;
  'leaderboard:update': (data: { leaderboard: LeaderboardEntry[] }) => void;
  'projector:data': (data: { qIndex: number; answerDistribution: Record<string, number>; leaderboard: LeaderboardEntry[] }) => void;
  'powerup:activated': (data: { type: PowerUpType; target?: string; source: string }) => void;
  'powerup:effect': (data: { type: PowerUpType; expiresIn: number }) => void;
  'game:finished': (data: { finalLeaderboard: LeaderboardEntry[] }) => void;
  'game:go-leaderboard': (data: { leaderboard: LeaderboardEntry[] }) => void;
  'podium:reveal': (data: { top3: LeaderboardEntry[] }) => void;
  'game:state-sync': (data: {
    pin: string;
    status: string;
    qIndex: number;
    question?: { text: string; options: Option[]; timeLimit: number; type?: string; hint?: string; media_url?: string; pairs?: { left: string; right: string }[] };
    players: string[];
    leaderboard: LeaderboardEntry[];
    isHintRevealed: boolean;
    hasAnswered: boolean;
    answerCount: number;
  }) => void;
  'error': (data: { message: string; code: string }) => void;
}

export interface ClientToServerEvents {
  'host:create': (data: { nickname: string }, callback: (res: { pin?: string; hostId?: string; error?: string }) => void) => void;
  'player:join': (data: { pin: string; nickname: string; fingerprint?: string }, callback: (res: { success: boolean; error?: string; players?: string[] }) => void) => void;
  'player:answer': (data: { pin: string; qIndex: number; answerIds: string[]; responseTimeMs: number }) => void;
  'player:submit-answer': (data: { pin: string; qIndex: number; answerIds: string[]; responseTimeMs: number }, callback: (res: { success: boolean; error?: string }) => void) => void;
  'host:start': (data: { pin: string; questions: any[] }) => void;
  'host:next': (data: { pin: string }) => void;
  'host:next-question': (data: { pin: string }, callback: (res: { success: boolean; finished?: boolean; error?: string }) => void) => void;
  'host:end': (data: { pin: string }) => void;
  'host:end-question': (data: { pin: string }) => void;
  'host:reveal-answer': (data: { pin: string }) => void;
  'host:go-leaderboard': (data: { pin: string }) => void;
  'host:reveal-hint': (data: { pin: string }) => void;
  'host:load-questions': (data: { pin: string; questions: Question[] }, callback: (res: { success: boolean; error?: string }) => void) => void;
  'powerup:use': (data: { pin: string; type: PowerUpType; target?: string }) => void;
  'ping': (data: { timestamp: number }) => void;
  'game:request-sync': (data: { pin: string }) => void;
}

