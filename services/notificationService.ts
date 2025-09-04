/**
 * Shows a system notification if permission has been granted by the user.
 * 
 * @param {boolean} enabled - A flag from settings to check if the user has opted-in via the UI.
 * @param {string} title - The title of the notification.
 * @param {NotificationOptions} [options] - Optional settings for the notification (e.g., body text, icon).
 */
export const showSystemNotification = (
    enabled: boolean,
    title: string,
    options?: NotificationOptions
): void => {
    if (!enabled || !('Notification' in window)) {
        return;
    }

    if (Notification.permission === 'granted') {
        const notification = new Notification(title, options);
    } else if (Notification.permission !== 'denied') {
        // We could ask for permission here, but it's better to
        // let the user initiate it from the settings UI.
        console.log('Notification permission has not been granted.');
    }
};
