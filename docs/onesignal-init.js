window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
        appId: "91cdf62f-fbb3-406c-b10e-ea632651b4cf",
        notifyButton: {
            enable: true,
        },
    });

    // This file is only loaded by cookie-consent.js once the visitor has agreed to notifications,
    // so asking here is covered by that consent. Skip anyone already subscribed or who blocked it;
    // OneSignal itself holds back the prompt for a while after it was dismissed.
    if (OneSignal.Notifications.isPushSupported()
        && OneSignal.Notifications.permission === false
        && !OneSignal.User.PushSubscription.optedIn
        && Notification.permission === 'default') {
        OneSignal.Slidedown.promptPush();
    }
});
