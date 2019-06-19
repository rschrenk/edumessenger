var isApp = document.URL.indexOf('?app') !== -1;
var isWebApp = document.URL.indexOf('?webapp') !== -1;
var fromReset = document.URL.indexOf('&fromReset') !== -1;
var isLocal = document.URL.indexOf( 'http://localhost' ) !== -1;
var noCache = (localStorage.getItem('edm6_nocache') != null) ? localStorage.getItem('edm6_nocache') : false;

var app = {
    cacheid: 'edm6_version',
    injectionsdb: undefined,
    injectionsdbname: 'edm6_injectionsdb',
    level: { central: 0, instance: 1, course: 2, message: 2, forum: 3, discussion: 4, post: 5, unknown: 10 },
	URL_CENTRAL: 'https://messenger.dibig.at/v-6', // The location of the plugin.
	URL_WEBAPP: 'https://messenger.dibig.at/6', // Root of webapp
	URL_ROOT: 'https://messenger.dibig.at/6', // Root of scripts and receive.php
    /**
     * Allows to override default urls by localStorage.
     */
    setUrls: function() {
        var items = ['URL_CENTRAL', 'URL_WEBAPP', 'URL_ROOT'];
        for (var a = 0; a < items.length; a++) {
            app[items[a]] = (localStorage.getItem(items[a]) !== null) ? localStorage.getItem(items[a]) : app[items[a]];
            console.log(items[a] + ' => ' + app[items[a]]);
        }
        isWebApp = top.location.href.indexOf(app.URL_WEBAPP) > -1;
        isApp = !isWebApp;
    },
    setTestServer: function(trigger) {
        if (trigger) {
            localStorage.setItem('URL_CENTRAL', 'https://eduvidual.dibig.at/local/eduvidualapp');
        } else {
            localStorage.removeItem('URL_CENTRAL');
        }
        top.location.reload();
    },
    setNoCache: function(trigger) {
        if (typeof trigger !== 'undefined' && trigger == 'always') {
            localStorage.setItem('edm6_nocache', trigger);
        } else if (trigger) {
            localStorage.setItem('edm6_nocache', trigger);
        } else {
            localStorage.removeItem('edm6_nocache');
        }
        top.location.reload();
    },
	initialize: function() {
        app.setUrls();
        if (localStorage.getItem('STARTUP_SHOW_BARS') !== null) $('#welcome .bar').css('display', 'block');
        console.log('app.initialize() - isApp: ' + isApp + ', isWebApp: ' + isWebApp + ', noCache: ' + noCache + ', fromReset: ' + fromReset);
        if(!fromReset && isApp) document.addEventListener('deviceready', app.onDeviceReady.bind(this), false);
        else $( window ).load(function() { app.receivedEvent('window.load() completed'); });
	},

	onDeviceReady: function() {
		console.log('app.onDeviceReady()');
		app.receivedEvent('deviceready');
	},

	receivedEvent: function(id) {
		console.log('app.receivedEvent('+id+')');
		app.initDB();
	},
	initDB: function(){
        try { StatusBar.hide(); } catch(e) {}

		var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;

		if(localStorage.getItem('delete_database')){
            console.log('Deleting database ' + localStorage.getItem('delete_database') + ' commanded from localStorage');
			indexedDB.deleteDatabase(localStorage.getItem('delete_database'));
			localStorage.removeItem('delete_database');
		}

		var request = indexedDB.open(app.injectionsdbname);

		request.onerror = function(event) {
			console.log('DB NOT SUPPORTED');
			alert('ERROR: DATABASE NOT SUPPORTED! APP WILL NOT WORK ON THIS DEVICE! '+event.message);
		};
		request.onblocked = function(event) {
			console.log('DB is blocked');
		};
		request.onsuccess = function(event) {
			console.log('DB loaded for basic setup');
			app.injectionsdb = request.result;
			app.inject();
		};
		request.onupgradeneeded = function(event) {
			console.log('DB Upgrade needed');
			var db = event.target.result;
			var store;

			// config: identifier
			if(!db.objectStoreNames.contains('injects')) db.createObjectStore('injects', { keyPath: 'identifier' });
		}
	},
	inject: function(){
		app.injectionsdb.transaction('injects').objectStore('injects').get('injections').onsuccess = function(event){
			var injections = event.target.result;
            // If there is something in cache - load at least this version.
			if(typeof injections !== 'undefined' && typeof injections.items !== 'undefined')
				app.injectItems(injections.items);
			CACHE.checkVersion();
		}
	},
	injectItems: function(o){
		console.log('Injecting items');
		console.log(o);
		$('head>.cache,body>.cache').remove();
		for(var a=0;a<o.length;a++){
			if(o[a].type == 'html'){
				$('body').append(o[a].content);
			} else {
				var el = $('<'+o[a].type+'>').addClass('cache').attr('data-id',o[a].id).attr('type','text/'+((o[a].type=='script')?'javascript':o[a].abbreviation));
				$(el)[0].innerHTML = o[a].content;
				$('head').append(el);
			}
		}
	},
};

app.initialize();


var pluginhost = {
	pluginpush: {
		registrationId: undefined,
		push: undefined,
		init: function(params){
            if (typeof window.PushNotification !== 'undefined') {
                console.error('Notification is supported via PushPlugin');
				pluginhost.pluginpush.push = PushNotification.init(params);
				PUSH.postInit();
			} else {
				console.error("PushNotification not supported via PushPlugin");
			}
			if (typeof window.Notification === 'undefined') {
				// We do not support it - do nothing
				console.error('Notification is not supported via Browser');
			} else if (Notification.permission === "granted") {
				// If it's okay let's create a notification
				console.log('Notification was permitted via Browser');
			} else if (Notification.permission !== 'denied') {
				// Otherwise, we need to ask the user for permission
				console.log('Notification was denied via Browser - requesting Permission');
				Notification.requestPermission(function (permission) {
					// If the user accepts, let's create a notification
					if (permission === "granted") {
						//alert('Thanks for granting permission - but this feature will be implemented in the future');
					}
				});
            }
		},
        registration: function(data) {
            console.log('GOT REGISTRATION DATA');
            console.log(data);
            localStorage.setItem('tmp_registration_data', JSON.stringify(data));
        },
		setBadge: function(count){
			var _push = pluginhost.pluginpush.push;
			if(_push!==undefined) {
				_push.setApplicationIconBadgeNumber(function() { console.log('iconBadgeNumber set to '+count); }, function() { console.error('Could not set iconBadgeNumber to '+count); }, count);
			} else {
				console.error("push plugin is not initialized");
			}
		},
		getBadge: function(){
			var _push = pluginhost.pluginpush.push;
			if(_push!==undefined) {
				_push.getApplicationIconBadgeNumber(function() {}, function() { console.error('Could not get iconBadgeNumber'); });
			} else {
				console.error("push plugin is not initialized");
			}
		},
		clearAllNotifications: function(){
			var _push = pluginhost.pluginpush.push;
			if(_push!==undefined) {
				_push.clearAllNotifications(function() { console.log('Notifications cleared'); }, function() { console.error('Could not clear Notifications'); });
			} else {
				console.error("push plugin is not initialized");
			}
		},
        error: function(e) {
            console.error('PushNotification Error: ' + e.message);
        },
		finish: function(id){
			var _push = pluginhost.pluginpush.push;
			if(_push!==undefined) {
				_push.finish(function() { console.log('Finished Id '+id); }, function() { console.error('Could not finish Id '+id); }, id);
			} else {
				console.error("push plugin is not initialized");
			}
		},
	},
	StatusBar: function(_do,what){
		try {
			switch(_do){
				case "hide":
					StatusBar.hide();
				break;
				case "show":
					StatusBar.show();
				break;
				case "overlaysWebview":
					StatusBar.overlaysWebView(what);
				break;
			}
		} catch(e) {}
	},
	QRScan: function(hook){
		if(!cordova.plugins || !cordova.plugins.barcodeScanner) ui.alert(language.t('Not_supported_by_browser'));
		else {
			cordova.plugins.barcodeScanner.scan(
				function (result) {
					try { hook.run(result.text);  } catch(e){ ui.alert('Could not handle '+result.text); }
				},
				function (error) {
					ui.alert("Scanning failed: " + error);
				},
				{
					"preferFrontCamera" : false, // iOS and Android
					"showFlipCameraButton" : true, // iOS and Android
					//"prompt" : "Place a barcode inside the scan area", // supported on Android only
					"formats" : "QR_CODE", // default: all but PDF_417 and RSS_EXPANDED
					//"orientation" : "landscape" // Android only (portrait|landscape), default unset so it rotates with the device
				}
			);
		}
	},
	saveToCameraRoll: function(files,success,error){
		setTimeout(function(){window.plugins.socialsharing.saveToPhotoAlbum(files,success,error);},0);
	},

	openInInit: function(){
		// iOS-Style
		try { window.handleOpenURL = function (url) { window.resolveLocalFileSystemURI(url,OPENIN.successiOS,OPENIN.error) }; } catch(e) {}
		// Android-Style
		try { window.plugins.intent.getCordovaIntent(OPENIN.successAndroid,OPENIN.error); } catch(e) {}
	},
}
