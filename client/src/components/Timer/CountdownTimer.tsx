import React from 'react';

interface CountdownTimerProps {
  seconds: number;
  totalDuration: number;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ seconds, totalDuration }) => {
  const radius = 40;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  
  const strokeDashoffset = totalDuration > 0 
    ? circumference - (seconds / totalDuration) * circumference 
    : circumference;

  const isLowTime = seconds <= 5;

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: '100px',
        height: '100px',
      }}
      className={isLowTime ? 'animate-timer-pulse' : ''}
    >
      <svg height="100" width="100">
        <circle
          stroke="var(--bg-secondary)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx="50"
          cy="50"
        />
        <circle
          stroke={isLowTime ? 'var(--color-accent)' : 'var(--text-primary)'}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset, transition: 'stroke-dashoffset 1s linear' }}
          r={normalizedRadius}
          cx="50"
          cy="50"
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span 
        style={{
          position: 'absolute',
          fontFamily: 'var(--font-title)',
          fontSize: '1.75rem',
          fontWeight: 800,
          color: isLowTime ? 'var(--color-accent)' : 'var(--text-primary)'
        }}
      >
        {seconds}
      </span>
    </div>
  );
};

export default CountdownTimer;
