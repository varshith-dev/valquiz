import { BreethClient } from '@breeth/sdk';
import { env } from '../config/env.js';
import { QuizFallback } from './QuizFallback.js';
import type { Question, QuestionType } from '../types/index.js';

// Initialize Breeth memory client
const breeth = new BreethClient({
  apiKey: env.BREETH_API_KEY,
});

interface GeminiResponse {
  questions: Array<{
    text: string;
    type: string;
    options: Array<{ id: string; text: string }>;
    correct: string[];
    explanation: string;
    difficulty: string;
  }>;
}

export class AiGenerator {
  // ─── Generate Quiz from Topic (with fallback) ────────
  static async generateFromTopic(
    topic: string,
    numQuestions: number = 10,
    difficulty: string = 'medium',
  ): Promise<Question[]> {
    try {
      return await AiGenerator.tryGeminiGeneration(topic, numQuestions, difficulty);
    } catch (err: any) {
      console.log(`⚠️ Gemini unavailable (${err.message?.substring(0, 50)}...), using fallback generator`);
      return AiGenerator.runFallback(topic, numQuestions, difficulty);
    }
  }

  // ─── Try Gemini AI Generation ──────────────────────
  private static async tryGeminiGeneration(
    topic: string,
    numQuestions: number,
    difficulty: string,
  ): Promise<Question[]> {
    // 1. Check Breeth memory for previous context
    let memoryContext = '';
    try {
      const memory: any = await breeth.retrieve({
        query: `Quiz questions about ${topic}`,
        limit: 3,
      });
      const items = Array.isArray(memory) ? memory : (memory as any)?.results || [];
      if (items.length > 0) {
        memoryContext = `\nPrevious context: ${JSON.stringify(items.slice(0, 2))}`;
      }
    } catch {
      console.log('⚠️ Breeth memory not available');
    }

    const prompt = `Generate a ${difficulty}-difficulty quiz about "${topic}" with exactly ${numQuestions} multiple-choice questions.

Return ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "questions": [
    {
      "text": "Question text here",
      "type": "mcq",
      "options": [
        { "id": "A", "text": "First option" },
        { "id": "B", "text": "Second option" },
        { "id": "C", "text": "Third option" },
        { "id": "D", "text": "Fourth option" }
      ],
      "correct": ["A"],
      "explanation": "Brief explanation of why this answer is correct",
      "difficulty": "${difficulty}"
    }
  ]
}\n${memoryContext}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 8192 },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      // If it's a quota/rate-limit, throw so we fallback
      if (response.status === 429 || response.status === 403) {
        throw new Error(`QUOTA_EXCEEDED: ${response.status}`);
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('No content in Gemini response');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse JSON from Gemini response');
    
    const parsed: GeminiResponse = JSON.parse(jsonMatch[0]);

    // Store in Breeth memory
    try {
      await breeth.write({
        content: `Generated a ${difficulty} quiz about "${topic}" with ${parsed.questions.length} questions`,
        groupId: 'valquiz-generated',
      });
    } catch {}

    return parsed.questions.map((q, i) => ({
      id: `q_${i + 1}`,
      text: q.text,
      type: (q.type === 'truefalse' ? 'truefalse' : 'mcq') as QuestionType,
      options: q.options,
      correct: q.correct,
      timeLimit: 20,
      explanation: q.explanation,
    }));
  }

  // ─── Fallback: Template-based Generation ────────────
  private static runFallback(
    topic: string,
    numQuestions: number,
    difficulty: string,
  ): Question[] {
    const fallback = QuizFallback.generate(topic, numQuestions, difficulty);
    return fallback.map((q) => ({
      id: q.id,
      text: q.text,
      type: 'mcq' as QuestionType,
      options: q.options,
      correct: q.correct,
      timeLimit: q.timeLimit,
      explanation: q.explanation,
    }));
  }

  // ─── Generate Quiz from Text Content ──────────────────
  static async generateFromText(
    text: string,
    numQuestions: number = 10,
  ): Promise<Question[]> {
    const prompt = `Based on the following text, generate exactly ${numQuestions} multiple-choice questions that test comprehension of the key concepts.

Return ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "questions": [
    {
      "text": "Question text here",
      "type": "mcq",
      "options": [
        { "id": "A", "text": "First option" },
        { "id": "B", "text": "Second option" },
        { "id": "C", "text": "Third option" },
        { "id": "D", "text": "Fourth option" }
      ],
      "correct": ["A"],
      "explanation": "Brief explanation of why this answer is correct",
      "difficulty": "medium"
    }
  ]
}

TEXT:
${text.substring(0, 8000)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        }),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('No content in Gemini response');

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse JSON from Gemini response');
    
    const parsed: GeminiResponse = JSON.parse(jsonMatch[0]);

    return parsed.questions.map((q, i) => ({
      id: `q_${i + 1}`,
      text: q.text,
      type: 'mcq' as QuestionType,
      options: q.options,
      correct: q.correct,
      timeLimit: 20,
      explanation: q.explanation,
    }));
  }
}
