import React, { useCallback, useState } from 'react';
import type { GameNotification, NotificationChoice } from '@nova-imperia/shared';

export interface NotificationPopupProps {
  /** The notification currently being displayed. */
  notification: GameNotification;
  /** How many additional notifications are queued behind this one. */
  queueLength: number;
  /** Called when the player dismisses the notification. */
  onDismiss: (silenceType: boolean) => void;
  /** Called when the player picks one of the notification's choices. */
  onChoice?: (choiceId: string) => void;
}

/**
 * Modal overlay that appears when an auto-pause notification fires.
 *
 * Displays the notification title, message and (optional) response choices.
 * If the notification type can be silenced, a "Do not alert me again" checkbox
 * is shown so the player can suppress future alerts of the same kind.
 */
export function NotificationPopup({
  notification,
  queueLength,
  onDismiss,
  onChoice,
}: NotificationPopupProps): React.ReactElement {
  const [silenceChecked, setSilenceChecked] = useState(false);

  const handleDismiss = useCallback(() => {
    onDismiss(silenceChecked);
  }, [onDismiss, silenceChecked]);

  const handleChoice = useCallback(
    (choice: NotificationChoice) => {
      onChoice?.(choice.id);
      onDismiss(silenceChecked);
    },
    [onChoice, onDismiss, silenceChecked],
  );

  const priorityClass = `notification-popup--${notification.priority}`;

  return (
    <div className="notification-popup-overlay">
      <div className={`notification-popup ${priorityClass}`}>
        {/* Priority badge */}
        <div className="notification-popup__priority">
          {notification.priority.toUpperCase()}
        </div>

        <h2 className="notification-popup__title">{notification.title}</h2>
        <p className="notification-popup__message">{notification.message}</p>

        {/* Choices (e.g. power plant recommission options) */}
        {notification.choices && notification.choices.length > 0 && (
          <div className="notification-popup__choices">
            {notification.choices.map((choice) => (
              <button
                key={choice.id}
                className="notification-popup__choice-btn"
                onClick={() => handleChoice(choice)}
                title={choice.description}
              >
                {choice.label}
              </button>
            ))}
          </div>
        )}

        {/* Silence checkbox */}
        {notification.canSilence && (
          <label className="notification-popup__silence">
            <input
              type="checkbox"
              checked={silenceChecked}
              onChange={(e) => setSilenceChecked(e.target.checked)}
            />
            <span>Do not alert me again</span>
          </label>
        )}

        {/* Footer: queue count + navigate + dismiss */}
        <div className="notification-popup__footer">
          {queueLength > 0 && (
            <span className="notification-popup__queue-count">
              +{queueLength} more
            </span>
          )}
          {notification.context?.systemId && (
            <button
              className="notification-popup__dismiss-btn"
              style={{ marginRight: 6, background: 'rgba(0, 100, 180, 0.4)' }}
              onClick={() => {
                const game = (window as any).__EX_NIHILO_GAME__;
                if (game?.events && notification.context?.systemId) {
                  game.events.emit('galaxy:navigate_to_system', {
                    systemId: notification.context.systemId,
                  });
                }
                handleDismiss();
              }}
            >
              Go to
            </button>
          )}
          <button
            className="notification-popup__dismiss-btn"
            onClick={handleDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
