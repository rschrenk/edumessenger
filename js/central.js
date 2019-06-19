var CENTRAL = {
    debug: 10,
    device: {},
    initialized: false,

    /**
     * Tells CENTRAL that the device exists.
     */
    announceDevice: function() {
        if (!CENTRAL.initialized) CENTRAL.init();
        console.log('CENTRAL.announceDevice()', CENTRAL.device);
        CONNECTOR.schedule({
            type: 'CENTRAL',
            data: {
                act: 'announceDevice',
                device: CENTRAL.device,
            }
        });
    },
    /**
     * Tells CENTRAL that we use a site. CENTRAL creates site-specific pushtoken for us.
     * @param site from MOODLE.getSite
     */
    announceSite: function(site) {
        if (!CENTRAL.initialized) CENTRAL.init();
        CONNECTOR.schedule({
            type: 'CENTRAL',
            data: {
                act: 'announceSite',
                site: site,
            }
        });
    },
    /**
     * Ensure we have some data about the device
     */
    init: function() {
        CENTRAL.device = DB.getConfig('device', {});
        if (typeof window.device !== 'undefined' && !empty(window.device.platform)) {
            var keys = Object.keys(window.device);
            for (var a = 0; a < keys.length; a++) {
                CENTRAL.device[keys[a]] = window.device[keys[a]];
            }
            CENTRAL.device.platform = window.device.platform.toLowerCase()
            CENTRAL.device.pushplatform = 'fcm';
            if (empty(CENTRAL.device.name)) {
                CENTRAL.device.name = CENTRAL.device.platform;
            }
        } else if (empty(CENTRAL.device.uuid)) {
            // Create a dummy device for webapp.
            CENTRAL.device = {
                manufacturer: window.navigator.userAgent,
                model: window.navigator.appVersion,
                name: window.navigator.appName,
                platform: window.navigator.platform,
                pushplatform: 'Webbrowser',
                uuid: uuidv4(),
                version: window.navigator.appVersion,
            };
        }
        if (empty(CENTRAL.device.pushid)) CENTRAL.device.pushid = '';
        DB.setConfig('device', CENTRAL.device);
        CENTRAL.initialized = true;
        CENTRAL.announceDevice();
    },
    disconnectDevice: function() {
        if (!CENTRAL.initialized) CENTRAL.init();
        console.log('CENTRAL.disconnectDevice()', CENTRAL.device);
        CONNECTOR.schedule({
            type: 'CENTRAL',
            data: {
                act: 'disconnectDevice',
                device: CENTRAL.device,
            }
        });
    },
    /**
     * Tells CENTRAL that we disconnected a site.
     * @param site from MOODLE.getSite
     */
    disconnectSite: function(site) {
        if (!CENTRAL.initialized) CENTRAL.init();
        CONNECTOR.schedule({
            type: 'CENTRAL',
            data: {
                act: 'disconnectSite',
                site: {
                    wwwroot: site.wwwroot,
                    userid: site.userid
                },
            }
        });
    },
}
