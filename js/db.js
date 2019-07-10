var DB = {
    debug: 1,
    k9: 999999999999999999, // Represents the unreachable timestamp for searching an index
    appid: 'edumessenger', // This is the app-id for moodle-local_eduauth.
    idbname: 'edm6',
    idbversion: 3,
    hasupgraded: false, // Triggers if a db upgrade has been made
    /**
    ** Sets an Item in Config
    ** @param item Name of Item
    ** @param value Value to set
    **/
    setConfig: function(item, value){
        if(typeof app.config === 'undefined') app.config = {};
        if(typeof value !== 'undefined') {
            app.db.transaction('config','readwrite').objectStore('config').put({ identifier: item, data: value, timestamp: new Date() });
            app.config[item] = value;
        } else {
            app.db.transaction('config','readwrite').objectStore('config').delete(item);
            delete(app.config[item]);
        }
    },
    /**
    ** Gets an Item out of Config
    ** @param item Name of Item
    ** @param expecteddefault If Item is not set we will return this value instead
    ** @return Value of Config-Item, or expecteddefault, or false
    **/
    getConfig: function(item, expecteddefault){
        if(typeof app.config !== 'undefined' && typeof app.config[item] !== 'undefined') return app.config[item];
        else if(typeof expecteddefault !== 'undefined') return expecteddefault;
        else return undefined;
    },
    /**
    ** Gets all keys in config
    **/
    getConfigKeys: function(){
        if (typeof app.config === 'undefined') return;
        return Object.keys(app.config);
    },
    /**
    ** Loads Config from IDB
    **/
    loadConfig: function(){
        if(DB.debug>0) console.log('DB.loadConfig()');
        app.config = {};
        app.db.transaction('config','readonly').objectStore('config').openCursor().onsuccess = function(event){
            if(event.target.result){
                app.config[event.target.result.value.identifier] = event.target.result.value.data;
                event.target.result.continue();
            } else {
                DB.loadCaches();
                CONNECTOR.init();
            }
        }
    },
    init: function(){
        if(DB.debug) console.log('DB.init()');

        $('#welcome .welcome-cache').removeClass('working').addClass('ok');
        $('#welcome .welcome-database').addClass('working');

        var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;
        //window.indexedDB.deleteDatabase('edumessenger-5');

        var request = indexedDB.open(DB.idbname, DB.idbversion);
        if (DB.debug > 0) console.log('Opened ', DB.idbname);

        request.onerror = function(event) {
            if (DB.debug > 0) console.log('DB NOT SUPPORTED');
            console.error(event);
            UI.alert('ERROR: DATABASE NOT SUPPORTED! APP WILL NOT WORK ON THIS DEVICE! '+event.message);
        };
        request.onblocked = function(event) {
            $('#welcome .welcome-database').removeClass('working').addClass('error');
            if (DB.debug > 0) console.log('DB is blocked');
        };
        request.onsuccess = function(event) {
            if (DB.debug > 0) console.log('DB loaded');
            app.db = request.result;
            DB.loadConfig();
        };
        request.onupgradeneeded = function(event) {
            if (DB.debug > 0) console.log('DB Upgrade needed');
            DB.hasupgraded = true;
            app.db = event.target.result;
            var store;

            // config: identifier
            if(!app.db.objectStoreNames.contains('config')) app.db.createObjectStore('config', { keyPath: 'identifier' });

            // requests: identifier
            if(!app.db.objectStoreNames.contains('requests')) app.db.createObjectStore('requests', { keyPath: 'requestId' });
            store = event.currentTarget.transaction.objectStore('requests');
            if(!store.indexNames.contains('requestId')) store.createIndex('requestId', 'requestId', { unique: true });
            if(!store.indexNames.contains('identifier')) store.createIndex('identifier', 'identifier', { unique: false });
            if(!store.indexNames.contains('type_identifier')) store.createIndex('type_identifier', ['type','identifier'], { unique: true });
            if(!store.indexNames.contains('level_requestId')) store.createIndex('level_requestId', ['level', 'requestId'], { unique: true });

            if(!app.db.objectStoreNames.contains('messages')) app.db.createObjectStore('messages', { keyPath: ['sitehash', 'messageid'] });
            store = event.currentTarget.transaction.objectStore('messages');
            if(!store.indexNames.contains('modified')) store.createIndex('modified', 'modified', { unique: false });
            if(!store.indexNames.contains('sitehash')) store.createIndex('sitehash', 'sitehash', { unique: false });
            if(!store.indexNames.contains('sitehash_conversationid_modified')) store.createIndex('sitehash_conversationid_modified', ['sitehash', 'conversationid', 'modified'], { unique: false });

            if(!app.db.objectStoreNames.contains('conversations')) app.db.createObjectStore('conversations', { keyPath: ['sitehash', 'conversationid'] });
            store = event.currentTarget.transaction.objectStore('conversations');
            if(!store.indexNames.contains('wwwroot_conversationid')) store.createIndex('wwwroot_conversationid', ['wwwroot', 'conversationid'], { unique: false });
            if(!store.indexNames.contains('modified')) store.createIndex('modified', 'modified', { unique: false });
            if(!store.indexNames.contains('sitehash')) store.createIndex('sitehash', 'sitehash', { unique: false });

            if(!app.db.objectStoreNames.contains('discussions')) app.db.createObjectStore('discussions', { keyPath: ['sitehash', 'discussionid'] });
            store = event.currentTarget.transaction.objectStore('discussions');
            if(!store.indexNames.contains('sitehash')) store.createIndex('sitehash', 'sitehash', { unique: false });
            if(!store.indexNames.contains('sitehash_forumid_modified')) store.createIndex('sitehash_forumid_modified', ['sitehash', 'forumid', 'modified'], { unique: false });
            if(!store.indexNames.contains('sitehash_forumid_groupid_modified')) store.createIndex('sitehash_forumid_groupid_modified', ['sitehash', 'forumid', 'groupid', 'modified'], { unique: false });

            if(!app.db.objectStoreNames.contains('posts')) app.db.createObjectStore('posts', { keyPath: ['sitehash', 'postid'] });
            store = event.currentTarget.transaction.objectStore('posts');
            if(!store.indexNames.contains('modified')) store.createIndex('modified', 'modified', { unique: false });
            if(!store.indexNames.contains('sitehash')) store.createIndex('sitehash', 'sitehash' ,{ unique: false });
            if(!store.indexNames.contains('sitehash_discussionid_modified')) store.createIndex('sitehash_discussionid_modified', ['sitehash', 'discussionid', 'modified'] ,{ unique: false });
            if(!store.indexNames.contains('sitehash_discussionid_groupid_modified')) store.createIndex('sitehash_discussionid_groupid_modified', ['sitehash', 'discussionid', 'groupid', 'modified'] ,{ unique: false });


            /*
            // courses: instanceid, courseid, fullname, shortname
            if(!app.db.objectStoreNames.contains('courses')) app.db.createObjectStore('courses', { keyPath: 'courseid' });
            store = event.currentTarget.transaction.objectStore('courses');
            if(!store.indexNames.contains('orderbyfullname')) store.createIndex('orderbyfullname', 'orderbyfullname' ,{ unique: false });
            */

            /*
            // courses_roles: instanceid, courseid, iuserid, roleid
            if(!app.db.objectStoreNames.contains('courses_roles')) app.db.createObjectStore('courses_roles', { keyPath: ['courseid','iuserid','roleid'] });
            store = event.currentTarget.transaction.objectStore('courses_roles');
            if(!store.indexNames.contains('courseid_iuserid')) store.createIndex('courseid_iuserid',['courseid','iuserid'],{ unique: false });

            // iusers: instanceid, iuserid, uid, fullname, pictureurl
            if(!app.db.objectStoreNames.contains('iusers')) app.db.createObjectStore('iusers', { keyPath: 'iuserid' });
            store = event.currentTarget.transaction.objectStore('iusers');
            if(!store.indexNames.contains('orderbyfullname')) store.createIndex('orderbyfullname','orderbyfullname',{ unique: false });
            if(!store.indexNames.contains('uid')) store.createIndex('uid','uid',{ unique: false });

            // pushcollection: We just use this to debug push messages
            if(!app.db.objectStoreNames.contains('pushcollection')) app.db.createObjectStore('pushcollection');
            */
        };
    },
    /**
    ** Load users, iusers, instances, courses, forums into objectCache
    **/
    loadCaches: function(){
        if (DB.debug > 0) console.log('DB.loadCaches()');

        // If the following values are false they will be preloaded, if they are true, they will not be preloaded
        //var stores = { users: false, iusers: false, instances: false, courses: false, forums: false };
        // Load nothing
        var stores = { iusers: true, courses: true };

        /*
        if(!stores['iusers']) {
            var iusers_order = [];
            app.db.transaction('iusers').objectStore('iusers').index('orderbyfullname').openCursor().onsuccess = function(event){
                var cursor = event.target.result;
                if(cursor){
                    iusers_order[iusers_order.length] = { instanceid: cursor.value.instanceid, iuserid: cursor.value.iuserid };
                    DB.putCache('iusers',cursor.value.instanceid+'_'+cursor.value.iuserid,cursor.value); cursor.continue();
                } else {
                    DB.putCache('iusers_order','all',iusers_order);
                    stores['iusers'] = true; DB.loadStores(stores);
                }
            };
        }
        */

        if(!stores['courses']) {
            app.db.transaction('courses').objectStore('courses').openCursor().onsuccess = function(event){
                var cursor = event.target.result;
                if(cursor){ DB.putCache('courses',cursor.value.instanceid+'_'+cursor.value.courseid,cursor.value); cursor.continue(); }
                else { stores['courses'] = true; DB.loadStores(stores); }
            };
        }

        DB.loadStores(stores);
    },
    /**
    ** Determine if all stores were loaded
    **/
    loadStores: function(stores){
        var keys = Object.keys(stores);
        for(var a=0;a<keys.length;a++) {
            if(!stores[keys[a]]) {
                return;
            }
        }

        $('#welcome .welcome-database').removeClass('working').addClass('ok');
        $('#welcome .welcome-interface').addClass('ok');

        CENTRAL.init();
        PUSH.init();
        UI.init();
        MOODLE.listSites();

        language.langSelectors();

        var sites = DB.getConfig('sites', {});
        if(Object.keys(sites).length > 0){
            MOODLE.getPrimarySite();
            Object.keys(sites).forEach(function(site) {
                Object.keys(sites[site]).forEach(function(userid) {
                    MOODLE.siteMyData(sites[site][userid].wwwroot, sites[site][userid].userid);
                    MOODLE.getCoursesScheduled(5000, sites[site][userid]);
                    POSTS.loadStream(sites[site].hash);
                    CONVERSATIONS.getConversations(sites[site]);
                });
            });

            // lists stream of posts and navigates there.
            // if not posts are loaded will navigate to #courses
            POSTS.listStream(30, true);
            CONVERSATIONS.listStream(30, true);
        } else {
            UI.navigate('#welcome');
        }
    },
    /**
    ** Writes properties from one object to another
    ** Used for Database-Rows as they could not be edited
    **/
    writeProperties: function(src,dst){
        //if(DB.debug>5) console.log('DB.writeProperties('+src+','+dst+')');
        Object.assign(dst, src);
        /*
        var keys = Object.keys(src);
        for(var a=0;a<keys.length;a++)
        dst[keys[a]] = src[keys[a]];
        */
    },
    getCache: function(type,identifier){
        if(app.objectCache[type]===undefined || app.objectCache[type][identifier]===undefined) return undefined;
        else {
            app.objectCache[type][identifier]['MYCACHEFLAGNUMBER']++;
            return app.objectCache[type][identifier];
        }
    },
    putCache: function(type,identifier,o){
        var alive = -1; // Seconds after the item will be removed from Cache
        if(type=='posts' && alive<0) alive = 20;

        o['MYCACHEFLAGNUMBER'] = 0;
        o['MYCACHEFLAGALIVE'] = alive;

        if(app.objectCache===undefined) app.objectCache = {};
        if(app.objectCache[type]===undefined) app.objectCache[type] =  {};
        app.objectCache[type][identifier] = o;
        if(alive>0)
        setTimeout('DB.removeCache(\''+type+'\',\''+identifier+'\',0)',alive*1000);
    },
    removeCache: function(type,identifier,flagnumber){
        if(app.objectCache[type][identifier]!==undefined && app.objectCache[type][identifier]['MYCACHEFLAGNUMBER']==flagnumber){
            // if(DB.debug>2) console.error('DB.removeCache('+type+','+identifier+')');
            delete(app.objectCache[type][identifier]);
        } else if(app.objectCache[type][identifier]!==undefined){
            var alive = app.objectCache[type][identifier]['MYCACHEFLAGALIVE'];
            var flagnumber = app.objectCache[type][identifier]['MYCACHEFLAGNUMBER'];
            if(alive>0)
            setTimeout('DB.removeCache(\''+type+'\',\''+identifier+'\','+flagnumber+')',alive*1000);
        }
    },
    reset: function(hard){
        if (DB.debug > 0) {
            console.log('DB.reset(hard)', hard);
            console.log(' => Removing cache-version', app.cacheid);
            console.log(' => Removing database', DB.idbname);
        }

        localStorage.removeItem(app.cacheid);
        localStorage.setItem('delete_database', DB.idbname);
        top.location.reload();
    },
}
