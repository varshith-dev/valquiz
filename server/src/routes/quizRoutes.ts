import { Router } from 'express';
import { GameManager } from '../game/GameManager.js';
import { AiGenerator } from '../game/AiGenerator.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ─── Health Check ──────────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'valquiz-server', version: '1.0.0', timestamp: Date.now() });
});

// ─── Generate Quiz via AI ──────────────────────────────
router.post('/quiz/generate', async (req, res) => {
  try {
    const { topic, numQuestions, difficulty } = req.body;
    if (!topic || typeof topic !== 'string') {
      res.status(400).json({ error: 'topic is required (string)' });
      return;
    }

    const questions = await AiGenerator.generateFromTopic(
      topic,
      Math.min(Math.max(numQuestions || 10, 3), 30),
      difficulty || 'medium',
    );

    res.json({
      success: true,
      topic,
      questions,
      generatedCount: questions.length,
    });
  } catch (err: any) {
    console.error('Generate quiz error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate quiz' });
  }
});

// ─── Generate Quiz from Text ───────────────────────────
router.post('/quiz/generate-from-text', async (req, res) => {
  try {
    const { text, numQuestions } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'text is required (string)' });
      return;
    }

    const questions = await AiGenerator.generateFromText(
      text,
      Math.min(Math.max(numQuestions || 10, 3), 30),
    );

    res.json({
      success: true,
      questions,
      generatedCount: questions.length,
    });
  } catch (err: any) {
    console.error('Generate from text error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate quiz from text' });
  }
});

// ─── Store a Quiz (to local JSON) ──────────────────────
router.post('/quiz', async (req, res) => {
  try {
    const { title, questions } = req.body;
    if (!title || !questions || !Array.isArray(questions)) {
      res.status(400).json({ error: 'title and questions[] required' });
      return;
    }

    const quiz = {
      id: uuidv4(),
      title,
      questions,
      createdAt: Date.now(),
    };

    // Store in Valkey for quick access
    const { getValkey } = await import('../config/env.js');
    const v = await getValkey();
    await v.set(`quiz:${quiz.id}`, JSON.stringify(quiz));
    await v.expire(`quiz:${quiz.id}`, 86400); // 24 hours

    // Also append to quiz list
    const existing = await v.get('quiz:index');
    const quizList = existing ? JSON.parse(existing) : [];
    quizList.push({ id: quiz.id, title: quiz.title, createdAt: quiz.createdAt });
    await v.set('quiz:index', JSON.stringify(quizList));

    res.json({ success: true, quiz });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get All Quizzes ───────────────────────────────────
router.get('/quiz', async (_req, res) => {
  try {
    const { getValkey } = await import('../config/env.js');
    const v = await getValkey();
    const raw = await v.get('quiz:index');
    const quizList = raw ? JSON.parse(raw) : [];
    res.json({ quizzes: quizList });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get Single Quiz ───────────────────────────────────
router.get('/quiz/:id', async (req, res) => {
  try {
    const { getValkey } = await import('../config/env.js');
    const v = await getValkey();
    const raw = await v.get(`quiz:${req.params.id}`);
    if (!raw) {
      res.status(404).json({ error: 'Quiz not found' });
      return;
    }
    res.json({ quiz: JSON.parse(raw) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Game State Check ────────────────────────────────
router.get('/game/:pin', async (req, res) => {
  try {
    const game = await GameManager.getGame(req.params.pin);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    const playerCount = await GameManager.getPlayerCount(req.params.pin);
    res.json({ game, playerCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
