/**
 * Fallback quiz generator when Gemini API is unavailable.
 * Generates high-quality mock questions for any topic.
 */

const QUESTION_TEMPLATES = [
  (topic: string) => ({
    text: `What is the primary purpose of ${topic}?`,
    type: 'mcq' as const,
    options: [
      { id: 'A', text: `To manage and organize ${topic.toLowerCase()} related tasks` },
      { id: 'B', text: 'To replace human decision-making entirely' },
      { id: 'C', text: 'To function without any external dependencies' },
      { id: 'D', text: 'To eliminate the need for user input' },
    ],
    correct: ['A'],
    explanation: `${topic} is primarily designed to streamline and manage tasks efficiently within its domain.`,
    difficulty: 'easy',
    timeLimit: 20,
  }),
  (topic: string) => ({
    text: `Which of the following best describes a key characteristic of ${topic}?`,
    type: 'mcq' as const,
    options: [
      { id: 'A', text: 'Scalability and flexibility in handling diverse requirements' },
      { id: 'B', text: 'Complete isolation from other systems' },
      { id: 'C', text: 'Inability to integrate with modern tools' },
      { id: 'D', text: 'Requires proprietary hardware to run' },
    ],
    correct: ['A'],
    explanation: `${topic} is known for its adaptable architecture that scales across different use cases.`,
    difficulty: 'easy',
    timeLimit: 20,
  }),
  (topic: string) => ({
    text: `When working with ${topic}, what is considered best practice?`,
    type: 'mcq' as const,
    options: [
      { id: 'A', text: 'Following established patterns and documentation' },
      { id: 'B', text: 'Ignoring all conventions for maximum creativity' },
      { id: 'C', text: 'Rewriting everything from scratch each time' },
      { id: 'D', text: 'Avoiding collaboration with team members' },
    ],
    correct: ['A'],
    explanation: 'Following best practices ensures maintainability, reliability, and team productivity.',
    difficulty: 'medium',
    timeLimit: 25,
  }),
  (topic: string) => ({
    text: `What is a common challenge faced when implementing ${topic}?`,
    type: 'mcq' as const,
    options: [
      { id: 'A', text: 'Managing complexity and ensuring consistent behavior' },
      { id: 'B', text: 'Finding developers who have heard of it' },
      { id: 'C', text: 'Convincing people it exists' },
      { id: 'D', text: 'Getting permission from regulatory bodies' },
    ],
    correct: ['A'],
    explanation: 'Complexity management is a universal challenge that requires careful architecture and testing.',
    difficulty: 'medium',
    timeLimit: 25,
  }),
  (topic: string) => ({
    text: `Which concept is most closely related to advanced ${topic} usage?`,
    type: 'mcq' as const,
    options: [
      { id: 'A', text: 'Performance optimization and resource management' },
      { id: 'B', text: 'Manually processing every single operation' },
      { id: 'C', text: 'Avoiding all automation' },
      { id: 'D', text: 'Keeping everything in a single monolithic structure' },
    ],
    correct: ['A'],
    explanation: 'Advanced usage typically focuses on optimizing performance and managing resources efficiently.',
    difficulty: 'hard',
    timeLimit: 30,
  }),
  (topic: string) => ({
    text: `What makes ${topic} different from traditional approaches?`,
    type: 'mcq' as const,
    options: [
      { id: 'A', text: 'Modern architecture that addresses current industry needs' },
      { id: 'B', text: 'It is exactly the same but with a new name' },
      { id: 'C', text: 'It only works in theory, not practice' },
      { id: 'D', text: 'It requires a PhD to understand' },
    ],
    correct: ['A'],
    explanation: `${topic} represents modern thinking in its domain, solving real problems with contemporary approaches.`,
    difficulty: 'medium',
    timeLimit: 25,
  }),
  (topic: string) => ({
    text: `How does ${topic} contribute to overall system efficiency?`,
    type: 'mcq' as const,
    options: [
      { id: 'A', text: 'By streamlining processes and reducing overhead' },
      { id: 'B', text: 'By doubling the amount of manual work required' },
      { id: 'C', text: 'By adding unnecessary complexity' },
      { id: 'D', text: 'By requiring constant human intervention' },
    ],
    correct: ['A'],
    explanation: `Efficiency gains come from ${topic.toLowerCase()}'s ability to automate and optimize core processes.`,
    difficulty: 'easy',
    timeLimit: 20,
  }),
  (topic: string) => ({
    text: `Which skill is most important for mastering ${topic}?`,
    type: 'mcq' as const,
    options: [
      { id: 'A', text: 'Understanding core principles and hands-on practice' },
      { id: 'B', text: 'Memorizing every possible error code' },
      { id: 'C', text: 'Being able to type extremely fast' },
      { id: 'D', text: 'Knowing the entire history of computing' },
    ],
    correct: ['A'],
    explanation: 'Practical understanding combined with theoretical knowledge leads to true mastery.',
    difficulty: 'easy',
    timeLimit: 20,
  }),
  (topic: string) => ({
    text: `In the context of ${topic}, what does "scalability" refer to?`,
    type: 'mcq' as const,
    options: [
      { id: 'A', text: 'The ability to handle growing amounts of work gracefully' },
      { id: 'B', text: 'The physical size of the infrastructure' },
      { id: 'C', text: 'How many people are needed to manage it' },
      { id: 'D', text: 'The number of features it has' },
    ],
    correct: ['A'],
    explanation: 'Scalability means the system can grow and handle increased demand without degrading performance.',
    difficulty: 'medium',
    timeLimit: 25,
  }),
  (topic: string) => ({
    text: `What is the future outlook for ${topic}?`,
    type: 'mcq' as const,
    options: [
      { id: 'A', text: 'Continued growth and increasing adoption across industries' },
      { id: 'B', text: 'It will be obsolete within a year' },
      { id: 'C', text: 'It will remain niche and rarely used' },
      { id: 'D', text: 'It will be replaced by something completely unrelated' },
    ],
    correct: ['A'],
    explanation: `${topic} shows strong potential for growth as more organizations recognize its value.`,
    difficulty: 'hard',
    timeLimit: 30,
  }),
];

export class QuizFallback {
  static generate(topic: string, numQuestions: number = 10, difficulty: string = 'medium'): Array<{
    id: string;
    text: string;
    type: string;
    options: Array<{ id: string; text: string }>;
    correct: string[];
    timeLimit: number;
    explanation?: string;
  }> {
    const count = Math.min(numQuestions, QUESTION_TEMPLATES.length);
    // Shuffle and pick templates, then rotate if we need more
    const indices = [...Array(QUESTION_TEMPLATES.length).keys()].sort(() => Math.random() - 0.5);
    const questions: Array<any> = [];

    for (let i = 0; i < count; i++) {
      const idx = indices[i % indices.length];
      const q = QUESTION_TEMPLATES[idx](topic);
      questions.push({
        id: `q_${i + 1}`,
        ...q,
      });
    }

    return questions;
  }
}
