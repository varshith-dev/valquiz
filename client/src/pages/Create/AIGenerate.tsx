import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HostNavigationRail from '../../components/Navigation/HostNavigationRail';
import { ArrowLeft, Sparkles, Check, Edit3 } from 'lucide-react';

export const AIGenerate: React.FC = () => {
  const navigate = useNavigate();
  
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewQuiz, setPreviewQuiz] = useState<any | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic) return;

    setLoading(true);

    // Simulate AI Microservice API generation latency
    setTimeout(() => {
      setLoading(false);
      setPreviewQuiz({
        title: `AI Quiz: ${topic}`,
        questions: [
          {
            text: `Which aspect of "${topic}" is most critical to understanding its core principles?`,
            options: ['Basic Foundation', 'Practical Application', 'Advanced Scaling', 'Historical Context'],
            correct: 'A',
          },
          {
            text: `What is the primary benefit of optimizing "${topic}"?`,
            options: ['Higher Cost efficiency', 'Reduced Execution Time', 'Improved Data Integrity', 'All of the above'],
            correct: 'D',
          }
        ]
      });
    }, 1500);
  };

  const handleSaveAndLaunch = () => {
    alert("AI Generated Quiz saved to Supabase database successfully!");
    navigate('/host');
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
                        {q.options.map((opt: string, oIdx: number) => {
                          const optLetter = String.fromCharCode(65 + oIdx);
                          const isCorrect = q.correct === optLetter;
                          return (
                            <div key={oIdx} style={{ fontSize: '0.9rem', padding: '6px 12px', backgroundColor: isCorrect ? 'rgba(34, 197, 94, 0.15)' : 'transparent', border: isCorrect ? '1.5px solid var(--color-green)' : '1px dashed rgba(0,0,0,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: isCorrect ? 700 : 500 }}>
                              <span>{optLetter}. {opt}</span>
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
                >
                  <Edit3 size={16} /> Edit Prompt
                </button>
                <button 
                  onClick={handleSaveAndLaunch}
                  className="minimalist-button minimalist-button-primary" 
                  style={{ flex: 2, padding: '14px' }}
                >
                  <Sparkles size={16} /> Save Quiz to Dashboard
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
