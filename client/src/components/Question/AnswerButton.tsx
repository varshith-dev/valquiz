import React from 'react';

interface AnswerButtonProps {
  optionId: 'A' | 'B' | 'C' | 'D';
  text: string;
  onClick?: () => void;
  disabled?: boolean;
  isSelected?: boolean;
  showCorrectness?: boolean;
  isCorrect?: boolean;
  isMasked?: boolean;
  colorOverride?: 'green' | 'red' | null;
  revealBorder?: boolean;
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
  isMasked = false,
  colorOverride = null,
  revealBorder = false,
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

  const getInlineStyles = () => {
    const styles: React.CSSProperties = {
      textAlign: 'left',
      justifyContent: 'flex-start',
      height: '100%',
      minHeight: '76px',
      padding: '16px 20px',
      transition: 'filter 0.3s ease, background-color 0.3s ease, color 0.3s ease',
    };

    if (isMasked) {
      styles.filter = 'grayscale(1) opacity(0.35)';
    }

    if (colorOverride === 'green') {
      styles.backgroundColor = 'var(--color-green)';
      styles.color = 'white';
    } else if (colorOverride === 'red') {
      styles.backgroundColor = 'var(--color-red)';
      styles.color = 'white';
    }

    if (revealBorder) {
      styles.border = '4px solid';
      styles.transform = 'translate(2px, 2px)';
    } else {
      styles.border = getBorderColor();
      if (isSelected) {
        styles.transform = 'translate(2px, 2px)';
        styles.boxShadow = '2px 2px 0px var(--text-primary)';
      }
    }

    return styles;
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`brutalist-button ${getBrutalistButtonClass()} ${revealBorder ? 'animate-border-reveal-green' : ''}`}
      style={getInlineStyles()}
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
