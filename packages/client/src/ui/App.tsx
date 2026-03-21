import React from 'react';

const VERSION = '0.1.0';

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  userSelect: 'none',
};

const versionBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 8,
  right: 12,
  fontFamily: 'monospace',
  fontSize: '11px',
  color: 'rgba(136, 153, 170, 0.6)',
  pointerEvents: 'auto',
};

/**
 * App is the React root rendered on top of the Phaser canvas.
 * The outer div uses pointer-events: none so mouse events pass through to
 * Phaser by default. Interactive React elements must set pointer-events: auto
 * individually.
 */
export function App(): React.ReactElement {
  return (
    <div style={overlayStyle}>
      {/* Minimal HUD */}
      <div style={versionBadgeStyle}>v{VERSION}</div>
    </div>
  );
}
