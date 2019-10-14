var PUSH = {
    debug: 1,
    registrationId: undefined,
    init: function(target){
        if (PUSH.debug > 0) console.log('PUSH.init()');
        if (typeof window.FirebasePlugin !== 'undefined') {
            /*
            window.FirebasePlugin.getToken(function(token) {
                // save this server-side and use it to push notifications to this device
                //console.log('GOT_FCM_TOKEN',token);
                //localStorage.setItem('GOT_FCM_TOKEN', token);
                //CENTRAL.device.pushid = token;
                //CENTRAL.announceDevice();
            }, function(error) {
            console.error(error);
            });
            */

            window.FirebasePlugin.onTokenRefresh(function(token) {
                // save this server-side and use it to push notifications to this device
                console.log('GOT_FCM_TOKEN_REFRESHED',token);
                localStorage.setItem('GOT_FCM_TOKEN_REFRESHED', token);
                CENTRAL.device.pushid = token;
                CENTRAL.announceDevice();
            }, function(error) {
                console.error(error);
            });

            window.FirebasePlugin.hasPermission(function(data){
                // For cordova-plugin-firebasex
                console.log('window.FirebasePlugin.hasPermission(data)', data);
                if (!data) {
                    window.FirebasePlugin.grantPermission();
                }
                // For cordova-plugin-firebase
                /*
                console.log(data.isEnabled);
                if (!data.isEnabled) {
                    window.FirebasePlugin.grantPermission();
                }
                */
            });
            var func = function(n) {
                console.log('FCM-Plugin.onMessageReceived(n)', n);
                var navigate = (typeof n.tap !== 'undefined' && n.tap);

                var possiblesites = MOODLE.siteGet(n.wwwroot, -1);
                var userids = Object.keys(possiblesites);
                userids.forEach(function(userid){
                    var site = possiblesites[userid];
                    if (typeof n.command !== 'undefined') {
                        if (n.command == 'delete_discussion') {
                            DISCUSSIONS.removeDiscussion(site, n.discussionid);
                        }
                        if (n.command == 'delete_post') {
                            POSTS.removePost(site, n.postid);
                        }
                    }
                    if (typeof n.discussionid !== 'undefined' && n.discussionid > 0) {
                        POSTS.load(site.hash, n.courseid, n.forumid, n.discussionid);
                    }
                    if (typeof n.conversationid !== 'undefined' && n.conversationid > 0) {
                        // Open the conversation
                        CONVERSATIONS.load(site, undefined, n.conversationid);
                    }
                });
            };
            // For corodva-plugin-firebase
            if (typeof window.FirebasePlugin.onNotificationOpen !== 'undefined')
                window.FirebasePlugin.onNotificationOpen(func, function(error) { console.error(error); });
            // For corodva-plugin-firebasex
            if (typeof window.FirebasePlugin.onMessageReceived !== 'undefined')
                window.FirebasePlugin.onMessageReceived(func, function(error) { console.error(error); });
            window.FirebasePlugin.setBadgeNumber(0);
        } else {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('js/push.js').then(function(reg) {
                    console.error('Registration', reg);
                    reg.pushManager.getSubscription().then(function(sub) {
                        if (sub === null) {
                            Notification.requestPermission(function (permission) {
                                // If the user accepts, let's create a notification
                                console.log(permission);
                                reg.pushManager.subscribe({
                                    applicationServerKey: urlB64ToUint8Array('BCNtO76MZzkJUHOupLuoVTIr2yKjGFGoQ3_DRNgEjTsclPZwmEXYI38rdZxwO_UIKfyLokq2xFxCZhWDqafwPEY'),
                                    userVisibleOnly: true,
                                }).then(function(sub) {
                                    console.log('We have a subscription', sub);
                                    CENTRAL.device.pushid = sub.endpoint;
                                    CENTRAL.announceDevice();
                                }).catch(function(e) {
                                    if (Notification.permission === 'denied') {
                                        console.error('Permission to push was denied');
                                    } else {
                                        console.error('Unable to subscribe to push', e);
                                    }
                                });
                            });
                        } else {
                            console.log('We have a subscription', sub);
                            CENTRAL.device.pushid = sub.endpoint;
                            CENTRAL.announceDevice();
                        }
                    });
                });
            }
        }
    },
    error: function(e) {
        console.error('PushNotification Error: '+e.message);
        //alert('PushNotification Error: '+e.message);
    },
}

function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
