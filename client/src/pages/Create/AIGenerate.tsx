import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HostNavigationRail from '../../components/Navigation/HostNavigationRail';
import { ArrowLeft, Sparkles, Check, Edit3, AlertCircle } from 'lucide-react';

export const AIGenerate: React.FC = () => {
  const navigate = useNavigate();
  
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewQuiz, setPreviewQuiz] = useState<any | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic,
          numQuestions: 10,
          difficulty: 'medium',
        }),
      });

      if (!response.ok) {
        throw new Error(`Generation failed: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setPreviewQuiz({
          title: `AI Quiz: ${data.topic || topic}`,
          questions: data.questions,
        });
      } else {
        throw new Error(data.error || 'Failed to generate quiz');
      }
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

    try {
      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: previewQuiz.title,
          questions: previewQuiz.questions,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save quiz: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
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
        // Append the new saved quiz
        localList.push(data.quiz);
        localStorage.setItem('valquiz_custom_quizzes', JSON.stringify(localList));

        navigate('/host');
      } else {
        throw new Error(data.error || 'Failed to save quiz to dashboard');
      }
    } catch (err: any) {
      console.error('Error saving quiz:', err);
      alert(`Error saving quiz: ${err.message}`);
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
            <button onClick={() => navigate('/host')} className="minimalist-button" style={{ padding: '8px' }}>
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
                  Prompt will be validated by FastAPI microservice schema
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
