import React, { useEffect, useState } from 'react';

interface ColoniseNotificationProps {
  planetName: string;
  onDismiss: () => void;
}

/**
 * Toast notification shown when a colony is successfully established.
 * Slides in from the top and auto-dismisses after 3 seconds.
 */
export function ColoniseNotification({
  planetName,
  onDismiss,
}: ColoniseNotificationProps): React.ReactElement {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-in on mount
    const showTimer = setTimeout(() => setVisible(true), 10);

    // Begin slide-out before calling onDismiss
    const hideTimer = setTimeout(() => setVisible(false), 2700);
    const dismissTimer = setTimeout(() => onDismiss(), 3000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  return (
    <div className={`colonise-notification${visible ? ' colonise-notification--visible' : ''}`}>
      <span className="colonise-notification__icon">◉</span>
      <div className="colonise-notification__body">
        <div className="colonise-notification__title">COLONY ESTABLISHED</div>
        <div className="colonise-notification__planet">{planetName}</div>
      </div>
    </div>
  );
}
