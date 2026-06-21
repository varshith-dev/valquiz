export interface Question {
  id: string;
  quiz_id?: string;
  sort_order?: number;
  type: 'mcq' | 'truefalse' | 'open' | 'ordering' | 'poll' | 'match';
  text: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  options: { id: string; text: string }[];
  correct: string[]; // e.g. ["A"] or ["A", "C"]
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  // Support both server format (timeLimit) and legacy client format (time_limit)
  timeLimit?: number;
  time_limit?: number;
  points?: 'standard' | 'double' | 'none';
  hint?: string;
  pairs?: { left: string; right: string }[];
}

/** Helper to get the time limit from a question regardless of field name */
export function getTimeLimit(q: Question): number {
  return q.timeLimit ?? q.time_limit ?? 20;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  cover_image?: string;
  created_by?: string;
  ai_generated?: boolean;
  tags?: string[];
  created_at?: string;
  questions?: Question[];
}

export interface Player {
  nickname: string;
  score: number;
  streak: number;
  rank?: number;
  isCorrect?: boolean;
  lastScore?: number;
}

export type GameStatus = 'idle' | 'lobby' | 'countdown' | 'question' | 'results' | 'leaderboard' | 'podium' | 'ended';

export interface GameState {
  pin: string;
  status: GameStatus;
  mode: 'classic' | 'balanced' | 'accuracy';
  currentQuestionIndex: number;
  questions: Question[];
  players: Player[];
  timer: number;
  totalQuestions: number;
  isHintRevealed?: boolean;
}

export interface LeaderboardEntry {
  nickname: string;
  score: number;
  streak: number;
  rank: number;
}

export interface AnswerResult {
  correct: boolean;
  correctAnswer: string[];
  pointsEarned: number;
  streak: number;
  responseTimeMs: number;
}
