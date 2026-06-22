import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HostNavigationRail from '../../components/Navigation/HostNavigationRail';
import { ArrowLeft, Sparkles, Check, Edit3, AlertCircle } from 'lucide-react';
import { safeRef, safeSet } from '../../services/firebase';

export const AIGenerate: React.FC = () => {
  const navigate = useNavigate();
  
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewQuiz, setPreviewQuiz] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [customApiKey, setCustomApiKey] = useState(localStorage.getItem('valquiz_gemini_api_key') || '');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic) return;

    setLoading(true);
    setError('');

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || customApiKey || '';
    if (!apiKey) {
      setError('Gemini API key is not configured. Please input your Gemini API key in the configuration field below.');
      setLoading(false);
      return;
    }

    const difficulty = 'medium';
    const numQuestions = 10;
    const prompt = `Generate a ${difficulty}-difficulty quiz about "${topic}" with exactly ${numQuestions} multiple-choice questions.

Return ONLY valid JSON in this exact format (do not wrap it in markdown code blocks like \`\`\`json ... \`\`\³, just return the raw JSON object string):
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
}`;

    const endpoints = [
      { url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, desc: 'gemini-1.5-flash on v1beta' },
      { url: `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, desc: 'gemini-1.5-flash on v1' },
      { url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, desc: 'gemini-2.5-flash on v1beta' },
      { url: `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`, desc: 'gemini-2.5-flash on v1' },
    ];

    let response: Response | null = null;
    let lastErrorMsg = '';

    for (const ep of endpoints) {
      try {
        console.log(`Attempting AI quiz generation using: ${ep.desc}`);
        const res = await fetch(ep.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: 8192 },
          }),
        });
        
        if (res.ok) {
          response = res;
          break;
        } else {
          const errText = await res.text().catch(() => '');
          lastErrorMsg = `Endpoint ${ep.desc} failed: ${res.status} ${res.statusText}. Response: ${errText}`;
          console.warn(lastErrorMsg);
        }
      } catch (err: any) {
        lastErrorMsg = `Endpoint ${ep.desc} connection error: ${err.message}`;
        console.error(lastErrorMsg);
      }
    }

    try {
      if (!response) {
        throw new Error(`All Gemini API endpoints failed. Last error: ${lastErrorMsg}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('No content in Gemini response');

      // Strip markdown code fences if Gemini returned them
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Could not parse JSON from Gemini response');
      
      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('Invalid quiz response structure from AI');
      }

      // Convert questions format to client structure
      const questionsList = parsed.questions.map((q: any, i: number) => ({
        id: `q_${i + 1}_${Date.now()}`,
        sort_order: i + 1,
        type: 'mcq' as const,
        text: q.text,
        options: q.options.map((opt: any) => ({
          id: opt.id,
          text: opt.text,
        })),
        correct: q.correct,
        time_limit: 20,
        hint: q.explanation || '',
      }));

      setPreviewQuiz({
        title: `AI Quiz: ${topic}`,
        questions: questionsList,
      });
    } catch (err: any) {
      console.error('Error generating quiz:', err);
      setError(err.message || 'An error occurred during AI quiz generation.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndLaunch = async () => {
    if (!previewQuiz) return;

    setLoading(true);
    setError('');

    const quizId = `quiz_${Date.now()}`;
    const newQuiz = {
      id: quizId,
      title: previewQuiz.title,
      description: `AI Generated Quiz about ${topic}`,
      questions: previewQuiz.questions,
      createdAt: Date.now(),
    };

    try {
      // Save directly to Firestore using our redefined safeSet
      await safeSet(safeRef(`quizzes/${quizId}`), newQuiz);

      // Save to localStorage for backward compatibility with components reading from it
      const raw = localStorage.getItem('valquiz_custom_quizzes');
      let localList = [];
      if (raw) {
        try {
          localList = JSON.parse(raw);
        } catch (e) {
          console.error('Failed to parse existing local quizzes', e);
        }
      }
      localList.push(newQuiz);
      localStorage.setItem('valquiz_custom_quizzes', JSON.stringify(localList));

      navigate('/a/host');
    } catch (err: any) {
      console.error('Error saving quiz:', err);
      setError(err.message || 'Failed to save quiz to dashboard.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="minimalist-container">
      <HostNavigationRail />

      <main className="minimalist-main">
        <header className="minimalist-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => navigate('/a/host')} className="minimalist-button" style={{ padding: '8px' }}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ fontSize: '2rem' }}>AI Quiz Generator</h1>
              <p style={{ color: 'var(--text-secondary)' }}>Instantly produce standard educational questions using Gemini API</p>
            </div>
          </div>
        </header>

        <div style={{ maxWidth: '800px' }}>
          {error && (
            <div 
              style={{ 
                padding: '12px 16px', 
                backgroundColor: 'var(--color-red)', 
                color: 'white', 
                fontWeight: 700, 
                borderRadius: '6px', 
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {!import.meta.env.VITE_GEMINI_API_KEY && !previewQuiz && (
            <div 
              className="minimalist-card animate-fade-in-up" 
              style={{ 
                border: '2px solid var(--color-brand)', 
                marginBottom: '20px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '12px' 
              }}
            >
              <label style={{ display: 'block', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.85rem', margin: 0 }}>
                Gemini API Key Configuration
              </label>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                To generate quizzes via AI in production, configure your Gemini API Key. It is stored locally in your browser.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="password"
                  placeholder="Paste your Gemini API key (e.g. AIzaSy...)"
                  value={customApiKey}
                  onChange={(e) => {
                    setCustomApiKey(e.target.value);
                    localStorage.setItem('valquiz_gemini_api_key', e.target.value);
                  }}
                  style={{ flexGrow: 1, padding: '10px', border: '1.5px solid var(--text-primary)', borderRadius: '4px', background: 'var(--bg-primary)', fontWeight: 600 }}
                />
                <button
                  type="button"
                  onClick={() => alert('Gemini API Key Saved Successfully!')}
                  className="minimalist-button minimalist-button-primary"
                  style={{ padding: '10px 20px', fontSize: '0.9rem' }}
                >
                  Save Key
                </button>
              </div>
            </div>
          )}

          {!previewQuiz ? (
            <form onSubmit={handleGenerate} className="minimalist-card" style={{ border: '2px solid var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 800, marginBottom: '8px', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                  What topic would you like to generate a quiz on?
                </label>
                <input
                  type="text"
                  placeholder="e.g. Valkey caching strategies, Quantum computing basics..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  style={{ width: '100%', padding: '14px', border: '2px solid var(--text-primary)', borderRadius: '6px', background: 'var(--bg-primary)', fontSize: '1.05rem', fontWeight: 600 }}
                  required
                  disabled={loading}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Prompt will be processed directly via Gemini API Client-side
                </span>
                
                <button 
                  type="submit" 
                  className="minimalist-button minimalist-button-primary"
                  style={{ padding: '12px 24px', fontSize: '0.95rem' }}
                  disabled={loading}
                >
                  <Sparkles size={16} /> {loading ? 'Generating via Gemini...' : 'Generate Questions'}
                </button>
              </div>
            </form>
          ) : (
            <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Preview Box */}
              <div className="minimalist-card" style={{ border: '2px solid var(--text-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--text-primary)', paddingBottom: '12px', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '1.25rem' }}>{previewQuiz.title}</h3>
                  <button onClick={() => setPreviewQuiz(null)} style={{ background: 'none', border: 'none', textDecoration: 'underline', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 700 }}>
                    Start Over
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {previewQuiz.questions.map((q: any, idx: number) => (
                    <div key={idx} style={{ padding: '16px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)' }}>
                      <div style={{ fontWeight: 800, marginBottom: '10px' }}>Q{idx + 1}: {q.text}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {q.options.map((opt: any, oIdx: number) => {
                          const optId = opt.id || String.fromCharCode(65 + oIdx);
                          const optText = opt.text || opt;
                          const isCorrect = Array.isArray(q.correct) ? q.correct.includes(optId) : q.correct === optId;
                          return (
                            <div key={oIdx} style={{ fontSize: '0.9rem', padding: '6px 12px', backgroundColor: isCorrect ? 'rgba(34, 197, 94, 0.15)' : 'transparent', border: isCorrect ? '1.5px solid var(--color-green)' : '1px dashed rgba(0,0,0,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: isCorrect ? 700 : 500 }}>
                              <span>{optId}. {optText}</span>
                              {isCorrect && <Check size={14} color="var(--color-green)" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <button 
                  onClick={() => setPreviewQuiz(null)}
                  className="minimalist-button" 
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  <Edit3 size={16} /> Edit Prompt
                </button>
                <button 
                  onClick={handleSaveAndLaunch}
                  className="minimalist-button minimalist-button-primary" 
                  style={{ flex: 2, padding: '14px' }}
                  disabled={loading}
                >
                  <Sparkles size={16} /> {loading ? 'Saving...' : 'Save Quiz to Dashboard'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AIGenerate;
