var PUSH = {
	debug: 1,
	registrationId: undefined,
	init: function(){
		if(PUSH.debug>0) console.log('PUSH.init()');

		if (typeof window.FirebasePlugin !== 'undefined') {
			window.FirebasePlugin.getToken(function(token) {
				// save this server-side and use it to push notifications to this device
				console.log('GOT_FCM_TOKEN',token);
				localStorage.setItem('GOT_FCM_TOKEN', token);
                CENTRAL.device.pushid = token;
			}, function(error) {
				console.error(error);
			});

			window.FirebasePlugin.onTokenRefresh(function(token) {
				// save this server-side and use it to push notifications to this device
				console.log('GOT_FCM_TOKEN_REFRESHED',token);
				localStorage.setItem('GOT_FCM_TOKEN_REFRESHED', token);
				CENTRAL.device.pushid = token;
			}, function(error) {
				console.error(error);
			});

			window.FirebasePlugin.hasPermission(function(data){
                // For cordova-plugin-firebasex
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
            // For corodva-plugin-firebase
			//window.FirebasePlugin.onNotificationOpen(function(notification) {
            // For corodva-plugin-firebasex
            window.FirebasePlugin.onMessageReceived(function(notification) {
			    console.log(notification);
				// Experimental to prevent actions when app is open
				if(typeof notification.tap !== 'undefined' && notification.tap) {
					var courseid = parseInt(notification['gcm.notification.courseid']);
					var iuserid = parseInt(notification['gcm.notification.iuserid']);

					DB.setConfig('LAST_NOTIFICATION', notification);
				} else {
					CONNECTOR.stream();
				}
			}, function(error) {
			    console.error(error);
			});
			window.FirebasePlugin.setBadgeNumber(0);
		}

		if (typeof window.FirebasePlugin === 'undefined') {
			localStorage.removeItem('tmp_registration_data');
	        if (isApp) PUSH.registration();
			//alert('push.init() PushNotification in Window? '+("PushNotification" in window));
			pluginhost.pluginpush.init(
				{
					android: {
						senderID: "205984702891",
						clearBadge: true,
						clearNotifications: true,
						sound: true,
						vibrate: true,
					},
		        		ios: {
						alert: true,
						badge: true,
						sound: true,
						clearBadge: true,
						categories: {
							post: {
								yes: {
									callback: "addtodo", title: "@ToDo", foreground: false, destructive: false
								},
							},
						},
					},
					windows: {},
					browser: { pushServiceURL: 'http://push.api.phonegap.com/v1/push' },
				}
			);
		}
	},
    /* DEPRECATED, now Done in central.js
	fcmStoreToken: function() {
		var pushdata = {
			platform: 'fcm',
			name: window.navigator.appName,
			uuid: '',
			model: window.navigator.platform,
			version: window.navigator.appVersion,
			pushid: PUSH.registrationId,
		};
		try {
			//pushdata.platform = (window.device!==undefined)?window.device.platform.toLowerCase():'n/a';
			pushdata.name = cordova.plugins.deviceName.name;
			pushdata.uuid = device.uuid;
			pushdata.model = device.model;
			pushdata.version = device.version;
		} catch(err) {
			console.debug(err);
		}

		console.error(pushdata);

		CONNECTOR.schedule({
			type: 'central',
			identifier: 'push_data',
			data: {
				act: 'push_data',
				pushdata: pushdata,
			},
			payload: {
				level: app.level.central,
			}
		},true);
	},
    */


	// ALL FUNCTIONS BELOW THIS LINE CAN BE REMOVED ONCE FCM IS STANDARD!

	postInit: function(){
		pluginhost.pluginpush.setBadge(0);
		pluginhost.pluginpush.push.on('registration', pluginhost.pluginpush.registration);
		pluginhost.pluginpush.push.on('notification', PUSH.receiveNotification);
		pluginhost.pluginpush.push.on('error', pluginhost.pluginpush.error);
		pluginhost.pluginpush.push.on('addtodo', PUSH.addTodo);
	},
	receiveNotification: function(data){
		app.db.tansaction('pushcollection', 'readwrite').objectStore('pushcollection').put(data);

		pluginhost.pluginpush.finish();
	},
    /*
	registration: function(){
        console.log('Check for registration_data');
        console.log(localStorage.getItem('tmp_registration_data'));
        if (localStorage.getItem('tmp_registration_data') !== null) {
            var data = localStorage.getItem('tmp_registration_data');
            if(PUSH.debug>0) console.log('PUSH.registration('+data+')');
            data = jQuery.parseJSON(data);

            if(typeof data.registrationId !== 'undefined') {
                PUSH.registrationId = data.registrationId;
            } else {
                if(PUSH.debug>0) console.error('NO REGISTRATION-ID FOR PUSHNOTIFICATIONS');
            }

            var pushdata = {
                platform: 'browser',
                name: window.navigator.appName,
                uuid: '',
                model: window.navigator.platform,
                version: window.navigator.appVersion,
                pushid: PUSH.registrationId,
            };
            try {
                pushdata.platform = (window.device!==undefined)?window.device.platform.toLowerCase():'n/a';
                pushdata.name = cordova.plugins.deviceName.name;
                pushdata.uuid = device.uuid;
                pushdata.model = device.model;
                pushdata.version = device.version;
            } catch(err) {
                console.debug(err);
            }

            console.error(pushdata);

            CONNECTOR.schedule({
                type: 'central',
                identifier: 'push_data',
                data: {
                    act: 'push_data',
                    pushdata: pushdata,
                },
                payload: {
                    level: app.level.central,
                }
            },true);
        } else {
            console.log('Re-Schedule PUSH.registration()');
            setTimeout(function(){ PUSH.registration(); },1000);
            return;
        }
	},
    */
	error: function(e) {
		console.error('PushNotification Error: '+e.message);
		//alert('PushNotification Error: '+e.message);
	},
}
