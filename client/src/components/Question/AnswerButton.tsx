import React from 'react';

interface AnswerButtonProps {
  optionId: 'A' | 'B' | 'C' | 'D';
  text: string;
  onClick?: () => void;
  disabled?: boolean;
  isSelected?: boolean;
  showCorrectness?: boolean;
  isCorrect?: boolean;
}

const shapeMap = {
  A: (
    <svg className="shape-icon" viewBox="0 0 24 24">
      <polygon points="12,3 2,21 22,21" />
    </svg>
  ), // Triangle
  B: (
    <svg className="shape-icon" viewBox="0 0 24 24">
      <polygon points="12,2 22,12 12,22 2,12" />
    </svg>
  ), // Diamond
  C: (
    <svg className="shape-icon" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
    </svg>
  ), // Circle
  D: (
    <svg className="shape-icon" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  ), // Square
};

export const AnswerButton: React.FC<AnswerButtonProps> = ({
  optionId,
  text,
  onClick,
  disabled = false,
  isSelected = false,
  showCorrectness = false,
  isCorrect = false,
}) => {
  const getBrutalistButtonClass = () => {
    switch (optionId) {
      case 'A': return 'brutalist-button-red';
      case 'B': return 'brutalist-button-blue';
      case 'C': return 'brutalist-button-yellow';
      case 'D': return 'brutalist-button-green';
      default: return '';
    }
  };

  const getBorderColor = () => {
    if (showCorrectness) {
      return isCorrect ? '4px solid #22c55e' : '4px solid #ef4444';
    }
    if (isSelected) {
      return '4px solid var(--color-brand)';
    }
    return 'var(--brutalist-border-width) solid var(--text-primary)';
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`brutalist-button ${getBrutalistButtonClass()}`}
      style={{
        border: getBorderColor(),
        transform: isSelected ? 'translate(2px, 2px)' : undefined,
        boxShadow: isSelected ? '2px 2px 0px var(--text-primary)' : undefined,
        textAlign: 'left',
        justifyContent: 'flex-start',
        height: '100%',
        minHeight: '76px',
        padding: '16px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
        {/* Geometric shape for accessibility */}
        <div style={{ flexShrink: 0, color: 'currentColor' }}>
          {shapeMap[optionId]}
        </div>
        
        {/* Answer Text */}
        <div style={{ flexGrow: 1, fontWeight: 700, fontSize: '1.05rem', wordBreak: 'break-word' }}>
          {text}
        </div>
      </div>
    </button>
  );
};

export default AnswerButton;
