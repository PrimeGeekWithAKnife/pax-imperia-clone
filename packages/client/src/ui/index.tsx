import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

/**
 * Mounts the React UI overlay onto #ui-root.
 * Called from src/main.ts after the Phaser game is created.
 */
export function mountUI(): void {
  const container = document.getElementById('ui-root');
  if (!container) {
    console.error('[UI] #ui-root element not found – React overlay will not mount');
    return;
  }

  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
