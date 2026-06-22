import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HostNavigationRail from '../../components/Navigation/HostNavigationRail';
import { ArrowLeft, Save, Plus, Trash, Upload, Image, Settings, X, CheckSquare, Square } from 'lucide-react';
import { safeRef, safeSet } from '../../services/firebase';

interface LocalQuestion {
  type: 'mcq' | 'match';
  text: string;
  options: string[]; // For MCQ options text
  correctAnswers: number[]; // For MCQ correct option indexes (supports multi-select)
  pairs: { left: string; right: string }[]; // For Match the Following pairs
  timeLimit: number; // Question duration in seconds
  hint: string; // Optional hint
  mediaUrl: string; // Uploaded media CDN URL
  isMultiChoice: boolean; // Tracks single choice vs checkbox mode
}

export const CreateQuiz: React.FC = () => {
  const navigate = useNavigate();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // OQENS Storage API configuration states (saved to localStorage)
  const [apiKey, setApiKey] = useState('');
  const [cloudId, setCloudId] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<Record<number, string>>({});
  const [uploadingState, setUploadingState] = useState<Record<number, boolean>>({});

  const [questions, setQuestions] = useState<LocalQuestion[]>([
    {
      type: 'mcq',
      text: 'Sample Multiple Choice Question?',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswers: [0],
      pairs: [],
      timeLimit: 20,
      hint: '',
      mediaUrl: '',
      isMultiChoice: false,
    },
  ]);

  // Load storage configurations on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('oqens_api_key');
    const storedCloud = localStorage.getItem('oqens_cloud_id');
    if (storedKey) setApiKey(storedKey);
    if (storedCloud) setCloudId(storedCloud);
  }, []);

  const handleSaveConfig = () => {
    localStorage.setItem('oqens_api_key', apiKey.trim());
    localStorage.setItem('oqens_cloud_id', cloudId.trim());
    setShowConfig(false);
    alert('OQENS Integration Credentials Saved!');
  };

  const handleAddMCQ = () => {
    setQuestions([
      ...questions,
      {
        type: 'mcq',
        text: '',
        options: ['Choice 1', 'Choice 2', 'Choice 3', 'Choice 4'],
        correctAnswers: [0],
        pairs: [],
        timeLimit: 20,
        hint: '',
        mediaUrl: '',
        isMultiChoice: false,
      },
    ]);
  };

  const handleAddMatch = () => {
    setQuestions([
      ...questions,
      {
        type: 'match',
        text: 'Match the correct pairs:',
        options: [],
        correctAnswers: [],
        pairs: [
          { left: 'Valkey', right: 'NoSQL In-Memory Key-Value' },
          { left: 'PostgreSQL', right: 'Relational DBMS' },
          { left: 'Neo4j', right: 'Graph DB' },
        ],
        timeLimit: 30,
        hint: '',
        mediaUrl: '',
        isMultiChoice: false,
      },
    ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  // Add options dynamically (MCQ)
  const handleAddOption = (qIdx: number) => {
    const updated = [...questions];
    if (updated[qIdx].options.length >= 6) {
      alert('Maximum of 6 options allowed.');
      return;
    }
    updated[qIdx].options.push(`Choice ${updated[qIdx].options.length + 1}`);
    setQuestions(updated);
  };

  const handleRemoveOption = (qIdx: number, oIdx: number) => {
    const updated = [...questions];
    if (updated[qIdx].options.length <= 2) {
      alert('Minimum of 2 options required.');
      return;
    }
    updated[qIdx].options = updated[qIdx].options.filter((_, i) => i !== oIdx);
    // Adjust correct answers list if any correct indexes shift or are removed
    updated[qIdx].correctAnswers = updated[qIdx].correctAnswers
      .filter((idx) => idx !== oIdx)
      .map((idx) => (idx > oIdx ? idx - 1 : idx));
    if (updated[qIdx].correctAnswers.length === 0) {
      updated[qIdx].correctAnswers = [0]; // default fallback
    }
    setQuestions(updated);
  };

  const handleToggleMCQCorrect = (qIdx: number, oIdx: number) => {
    const updated = [...questions];
    const q = updated[qIdx];
    if (q.isMultiChoice) {
      // Checkbox behaviour
      if (q.correctAnswers.includes(oIdx)) {
        if (q.correctAnswers.length > 1) {
          q.correctAnswers = q.correctAnswers.filter((i) => i !== oIdx);
        }
      } else {
        q.correctAnswers.push(oIdx);
      }
    } else {
      // Radio behaviour
      q.correctAnswers = [oIdx];
    }
    setQuestions(updated);
  };

  // OQENS File Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, qIdx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!apiKey.trim() || !cloudId.trim()) {
      setUploadErrors((prev) => ({
        ...prev,
        [qIdx]: 'Please save OQENS credentials in upload settings above.',
      }));
      return;
    }

    setUploadingState((prev) => ({ ...prev, [qIdx]: true }));
    setUploadErrors((prev) => ({ ...prev, [qIdx]: '' }));

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('https://auth.oqens.me/api/bucket/upload', {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey.trim(),
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed with status: ${res.status}`);
      }

      const data = await res.json();
      // Safe resolution of file key from response payload
      const fileKey = data.key || data.filename || file.name;
      const finalUrl = `https://dl.oqens.me/${cloudId.trim()}/${fileKey}`;

      const updated = [...questions];
      updated[qIdx].mediaUrl = finalUrl;
      setQuestions(updated);
    } catch (err: any) {
      console.error(err);
      setUploadErrors((prev) => ({
        ...prev,
        [qIdx]: err.message || 'Network upload error.',
      }));
    } finally {
      setUploadingState((prev) => ({ ...prev, [qIdx]: false }));
    }
  };

  const handleSaveQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a quiz title');
      return;
    }

    // Convert local schema to active Question list
    const parsedQuestions = questions.map((q, idx) => {
      if (q.type === 'match') {
        return {
          id: `q_${idx}_${Date.now()}`,
          sort_order: idx + 1,
          type: 'match' as const,
          text: q.text,
          media_url: q.mediaUrl || undefined,
          media_type: q.mediaUrl ? ('image' as const) : undefined,
          options: [],
          correct: [], // match evaluation is done differently
          pairs: q.pairs,
          time_limit: q.timeLimit,
          hint: q.hint || undefined,
        };
      } else {
        return {
          id: `q_${idx}_${Date.now()}`,
          sort_order: idx + 1,
          type: 'mcq' as const,
          text: q.text,
          media_url: q.mediaUrl || undefined,
          media_type: q.mediaUrl ? ('image' as const) : undefined,
          options: q.options.map((opt, oIdx) => ({
            id: String.fromCharCode(65 + oIdx), // A, B, C, D...
            text: opt,
          })),
          correct: q.correctAnswers.map((oIdx) => String.fromCharCode(65 + oIdx)),
          time_limit: q.timeLimit,
          hint: q.hint || undefined,
        };
      }
    });

    const quizId = `quiz_${Date.now()}`;
    const newQuiz = {
      id: quizId,
      title,
      description,
      questions: parsedQuestions,
    };

    try {
      // Save to Firebase Realtime DB
      await safeSet(safeRef(`quizzes/${quizId}`), newQuiz);

      alert('Quiz created successfully! You can select and host it from your Active Quiz list in the lobby.');
      navigate('/a/host');
    } catch (err: any) {
      console.error('Failed to save quiz to Firebase:', err);
      alert(`Failed to save quiz: ${err.message || err}`);
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
              <h1 style={{ fontSize: '2rem' }}>Quiz Creator</h1>
              <p style={{ color: 'var(--text-secondary)' }}>Manually compose questions, image uploads, and matching pairs</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="minimalist-button"
              style={{ padding: '10px 16px' }}
            >
              <Settings size={16} /> OQENS Settings
            </button>
            <button onClick={handleSaveQuiz} className="minimalist-button minimalist-button-primary">
              <Save size={16} /> Save Quiz
            </button>
          </div>
        </header>

        {/* Credentials Settings Card */}
        {showConfig && (
          <div 
            className="minimalist-card animate-fade-in-up" 
            style={{ border: '3px solid var(--color-brand)', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <h3 style={{ fontWeight: 800 }}>OQENS Cloud Storage Settings</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              To enable image uploads directly to your question cards, input your tokens. Get credentials at <a href="https://echo.oqens.me" target="_blank" rel="noreferrer" style={{ color: 'var(--color-brand)' }}>echo.oqens.me</a>.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>Cloud ID</label>
                <input
                  type="text"
                  placeholder="e.g. your-tenant-cloud-id"
                  value={cloudId}
                  onChange={(e) => setCloudId(e.target.value)}
                  style={{ width: '100%', padding: '10px', border: '1.5px solid var(--text-primary)', borderRadius: '4px', background: 'var(--bg-primary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>X-API-Key</label>
                <input
                  type="password"
                  placeholder="your_secret_api_key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  style={{ width: '100%', padding: '10px', border: '1.5px solid var(--text-primary)', borderRadius: '4px', background: 'var(--bg-primary)' }}
                />
              </div>
            </div>
            <button onClick={handleSaveConfig} className="minimalist-button minimalist-button-primary" style={{ alignSelf: 'flex-start' }}>
              Save Credentials
            </button>
          </div>
        )}

        <form onSubmit={handleSaveQuiz} style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Metadata */}
          <div className="minimalist-card" style={{ border: '2px solid var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '6px' }}>Quiz Title</label>
              <input
                type="text"
                placeholder="e.g. Valkey Performance Optimization Quiz"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: '100%', padding: '12px', border: '1.5px solid var(--text-primary)', borderRadius: '4px', background: 'var(--bg-primary)' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '6px' }}>Description</label>
              <textarea
                placeholder="Brief summary..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: '100%', padding: '12px', border: '1.5px solid var(--text-primary)', borderRadius: '4px', background: 'var(--bg-primary)', minHeight: '80px', resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Question List */}
          <h3 style={{ fontSize: '1.25rem', marginTop: '12px' }}>Questions ({questions.length})</h3>
          
          {questions.map((q, qIdx) => (
            <div key={qIdx} className="minimalist-card animate-fade-in-up" style={{ border: '2px solid var(--text-primary)', position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800 }}>Question #{qIdx + 1} ({q.type === 'match' ? 'Match the Following' : 'Multiple Choice'})</span>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveQuestion(qIdx)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer' }}
                  >
                    <Trash size={18} />
                  </button>
                )}
              </div>

              {/* Question Text */}
              <input
                type="text"
                placeholder="Question text..."
                value={q.text}
                onChange={(e) => {
                  const updated = [...questions];
                  updated[qIdx].text = e.target.value;
                  setQuestions(updated);
                }}
                style={{ width: '100%', padding: '12px', border: '1.5px solid var(--text-primary)', borderRadius: '4px', background: 'var(--bg-primary)' }}
                required
              />

              {/* Settings: Timer, Optional Hint, Media Upload */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                {/* Timer Limit */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>Timer Limit</label>
                  <select
                    value={q.timeLimit}
                    onChange={(e) => {
                      const updated = [...questions];
                      updated[qIdx].timeLimit = parseInt(e.target.value);
                      setQuestions(updated);
                    }}
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--text-primary)', borderRadius: '4px', background: 'var(--bg-primary)' }}
                  >
                    <option value={10}>10 Seconds</option>
                    <option value={15}>15 Seconds</option>
                    <option value={20}>20 Seconds</option>
                    <option value={30}>30 Seconds</option>
                    <option value={60}>60 Seconds</option>
                    <option value={90}>90 Seconds</option>
                  </select>
                </div>

                {/* Optional Hint */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>Hint (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Look at the key prefix..."
                    value={q.hint}
                    onChange={(e) => {
                      const updated = [...questions];
                      updated[qIdx].hint = e.target.value;
                      setQuestions(updated);
                    }}
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--text-primary)', borderRadius: '4px', background: 'var(--bg-primary)' }}
                  />
                </div>

                {/* Media Image Uploader */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>Image Upload</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="file"
                      accept="image/*"
                      id={`file-upload-${qIdx}`}
                      onChange={(e) => handleFileUpload(e, qIdx)}
                      style={{ display: 'none' }}
                      disabled={uploadingState[qIdx]}
                    />
                    <label
                      htmlFor={`file-upload-${qIdx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px',
                        border: '1.5px dashed var(--text-primary)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        backgroundColor: 'var(--bg-secondary)',
                        textAlign: 'center'
                      }}
                    >
                      <Upload size={14} /> {uploadingState[qIdx] ? 'Uploading...' : 'Choose Image'}
                    </label>
                  </div>
                </div>
              </div>

              {/* Upload Fail / Preview Indicators */}
              {uploadErrors[qIdx] && (
                <div style={{ color: 'var(--color-accent)', fontSize: '0.8rem', fontWeight: 650 }}>
                  * {uploadErrors[qIdx]}
                </div>
              )}

              {q.mediaUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', border: '1px solid var(--text-primary)', borderRadius: '4px' }}>
                  <Image size={18} />
                  <span style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexGrow: 1 }}>
                    {q.mediaUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...questions];
                      updated[qIdx].mediaUrl = '';
                      setQuestions(updated);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* MCQ Choices Fields */}
              {q.type === 'mcq' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Select answering logic */}
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid var(--text-primary)', paddingBottom: '6px' }}>
                    <span>Answering Options:</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name={`mode-${qIdx}`} 
                        checked={!q.isMultiChoice}
                        onChange={() => {
                          const updated = [...questions];
                          updated[qIdx].isMultiChoice = false;
                          updated[qIdx].correctAnswers = [updated[qIdx].correctAnswers[0] || 0];
                          setQuestions(updated);
                        }}
                      />
                      Single Choice
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name={`mode-${qIdx}`} 
                        checked={q.isMultiChoice}
                        onChange={() => {
                          const updated = [...questions];
                          updated[qIdx].isMultiChoice = true;
                          setQuestions(updated);
                        }}
                      />
                      Multiple Choices
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {q.options.map((opt, oIdx) => {
                      const isCorrect = q.correctAnswers.includes(oIdx);
                      return (
                        <div key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleMCQCorrect(qIdx, oIdx)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              color: isCorrect ? 'var(--color-brand)' : 'var(--text-primary)',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Toggle correct state"
                          >
                            {isCorrect ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                          <input
                            type="text"
                            placeholder={`Choice ${String.fromCharCode(65 + oIdx)}`}
                            value={opt}
                            onChange={(e) => {
                              const updated = [...questions];
                              updated[qIdx].options[oIdx] = e.target.value;
                              setQuestions(updated);
                            }}
                            style={{ flexGrow: 1, padding: '8px', border: '1px solid var(--text-primary)', borderRadius: '4px', background: 'var(--bg-primary)' }}
                            required
                          />
                          {q.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(qIdx, oIdx)}
                              style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer' }}
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {q.options.length < 6 && (
                    <button
                      type="button"
                      onClick={() => handleAddOption(qIdx)}
                      className="minimalist-button"
                      style={{ padding: '6px 12px', fontSize: '0.8rem', borderStyle: 'dashed', borderWidth: '1.5px', alignSelf: 'flex-start' }}
                    >
                      + Add Option Choice
                    </button>
                  )}
                </div>
              )}

              {/* Match the Following Editor */}
              {q.type === 'match' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, borderBottom: '1px solid var(--text-primary)', paddingBottom: '6px' }}>
                    Match Mappings (Left Column matched with Right Column):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {q.pairs.map((pair, pIdx) => (
                      <div key={pIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Term (Left)"
                          value={pair.left}
                          onChange={(e) => {
                            const updated = [...questions];
                            updated[qIdx].pairs[pIdx].left = e.target.value;
                            setQuestions(updated);
                          }}
                          style={{ padding: '8px', border: '1px solid var(--text-primary)', borderRadius: '4px', background: 'var(--bg-primary)' }}
                          required
                        />
                        <input
                          type="text"
                          placeholder="Match Definition (Right)"
                          value={pair.right}
                          onChange={(e) => {
                            const updated = [...questions];
                            updated[qIdx].pairs[pIdx].right = e.target.value;
                            setQuestions(updated);
                          }}
                          style={{ padding: '8px', border: '1px solid var(--text-primary)', borderRadius: '4px', background: 'var(--bg-primary)' }}
                          required
                        />
                        {q.pairs.length > 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...questions];
                              updated[qIdx].pairs = updated[qIdx].pairs.filter((_, i) => i !== pIdx);
                              setQuestions(updated);
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer' }}
                          >
                            <Trash size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {q.pairs.length < 5 && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...questions];
                        updated[qIdx].pairs.push({ left: '', right: '' });
                        setQuestions(updated);
                      }}
                      className="minimalist-button"
                      style={{ padding: '6px 12px', fontSize: '0.8rem', borderStyle: 'dashed', borderWidth: '1.5px', alignSelf: 'flex-start' }}
                    >
                      + Add Match Mapping Pair
                    </button>
                  )}
                </div>
              )}

            </div>
          ))}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={handleAddMCQ}
              className="minimalist-button"
              style={{ borderStyle: 'dashed', borderWidth: '2px' }}
            >
              <Plus size={16} /> Add Multiple Choice
            </button>
            <button
              type="button"
              onClick={handleAddMatch}
              className="minimalist-button"
              style={{ borderStyle: 'dashed', borderWidth: '2px' }}
            >
              <Plus size={16} /> Add Match the Following
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default CreateQuiz;
