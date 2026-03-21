import React, { useEffect, useRef, useState } from 'react';

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
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 10);
    const hideTimer = setTimeout(() => setVisible(false), 2700);
    const dismissTimer = setTimeout(() => onDismissRef.current(), 3000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearTimeout(dismissTimer);
    };
  }, []); // Run once on mount — no deps to avoid timer reset

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
