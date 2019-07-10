var CACHE = {
    debug: 1,
    items: [
        { type: 'script', id: 'availability', file: 'js/availability.js', abbreviation: 'js' },
        { type: 'script', id: 'cache', file: 'js/cache.js', abbreviation: 'js' },
        { type: 'script', id: 'connector', file: 'js/connector.js', abbreviation: 'js' },
        { type: 'script', id: 'courses', file: 'js/courses.js', abbreviation: 'js' },
        { type: 'script', id: 'conversations', file: 'js/conversations.js', abbreviation: 'js' },
        { type: 'script', id: 'db', file: 'js/db.js', abbreviation: 'js' },
        { type: 'script', id: 'discussions', file: 'js/discussions.js', abbreviation: 'js' },
        //{ type: 'script', id: 'helper', file: 'js/helper.js', abbreviation: 'js' },
        { type: 'script', id: 'moodle', file: 'js/moodle.js', abbreviation: 'js' },
        { type: 'script', id: 'lang', file: 'js/lang.js', abbreviation: 'js' },
        { type: 'script', id: 'lib', file: 'js/lib.js', abbreviation: 'js' },
        { type: 'script', id: 'posts', file: 'js/posts.js', abbreviation: 'js' },
        { type: 'script', id: 'push', file: 'js/push.js', abbreviation: 'js' },
        { type: 'script', id: 'ui', file: 'js/ui.js', abbreviation: 'js' },
        //{ type: 'script', id: 'user', file: 'js/user.js', abbreviation: 'js' },
        { type: 'style', id: 'gfx', file: 'css/gfx.css', abbreviation: 'css' },
        { type: 'style', id: 'main', file: 'css/main.css', abbreviation: 'css' },
        { type: 'html', id: 'body', file: 'body.php', abbreviation: 'html' },
    ],
    loadCnt: 0,
    checkVersion: function(){
        if (CACHE.debug > 0) console.log('CACHE.checkVersion()');
        $('#welcome .welcome-cache').addClass('working');
        app.fromVersion = +localStorage.getItem(app.cacheid);
        app.currentVersion = +localStorage.getItem(app.cacheid);
        if (typeof noCache !== 'undefined' && noCache == 'always') app.fromVersion = 0;
        if (typeof noCache !== 'undefined' && noCache == '1') {
            if (CACHE.debug > 0) console.log('NO CACHE - DIRECTLY TO DB.INIT()');
            DB.init();
            return;
        } else if(isLocal) {
            if (CACHE.debug > 0) console.log('LOCAL: loading ' + app.URL_ROOT + '/body.php only');
            $.ajax({
                url: app.URL_ROOT+'/body.php',
                type: 'GET',
                cache: false,
                encoding: 'UTF-8',
            }).done(function(result){
                $('body .cache').remove();
                $('body').append(result);
                UI.init();
                if (noCache) {
                    $('div[data-role="header"]').attr('style','background-color: red;');
                }
            });

            DB.init();
            return;
        }
        CACHE.fetchVersion();
    },
    fetchVersion: function(){
        $.ajax({
            url: app.URL_ROOT + '/receive.php?file=version.txt',
            type: 'GET',
            //cache: false,
            encoding: 'UTF-8',
        }).done(function(result){
            if (CACHE.debug > 0) console.log('=> Fetched Version from Server', result);
            CACHE.fetchedVersion(result.trim());
        });
    },
    fetchedVersion: function(version){
        if (CACHE.debug > 0) console.log('=> Current Version: ' + app.fromVersion);
        if (CACHE.debug > 0) console.log('=> Web Version: ', version);
        if (version != app.fromVersion)
            CACHE.loadItems(version);
        else
            DB.init();
    },
    /**
    ** Check Version and show update-info if version differs
    ** @param version Version that is current on server
    **/
    testVersion: function(version){
        version = version.trim();
        //console.error('Comparing versions', version, localStorage.getItem('eduvidual_3_version'));
        if (version != app.currentVersion && !noCache) {
            $('#infoUpdate').removeClass('hidden');
        } else if(noCache) {
            if (CACHE.debug > 0) console.log('Showing infoUpdate suppressed as we have noCache');
        }
    },
    loadItems: function(version){
        CACHE.loadCnt = CACHE.items.length;
        for(var a=0;a<CACHE.items.length;a++)
        CACHE.loadItem(a,version);
    },
    loadItem: function(a,version){
        if (CACHE.debug > 5) console.log('Loading ==> ' + CACHE.items[a].id);
        var url = app.URL_ROOT + '/receive.php?file=' + encodeURI(CACHE.items[a].file);
        if (CACHE.items[a].file == 'body.php') {
            url = app.URL_ROOT + '/' + CACHE.items[a].file;
        }
        $.ajax({
            url: url,
            type: 'GET',
            // Seems to make problems with android.
            //cache: false,
            encoding: 'UTF-8',
        }).done(function(result){
            if (CACHE.debug > 5) console.log('Loaded ==> ' + CACHE.items[a].id + ' with ' + result.length + ' Bytes');
            if(result.trim()!='')
            CACHE.items[a].content = result;
            CACHE.diminishCount(version);
        });
    },
    diminishCount: function(version){
        CACHE.loadCnt--;
        if (typeof version !== 'undefined') version = version.trim();
        if (CACHE.loadCnt == 0) {
            localStorage.setItem(app.cacheid, version);
            app.currentVersion = version;
            app.injectionsdb.transaction('injects','readwrite').objectStore('injects').put({ identifier: 'injections', items: CACHE.items, version: version }).onsuccess = function(event){
                app.injectItems(CACHE.items);
                DB.init();
            }
        }
    }
}
