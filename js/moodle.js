var MOODLE = {
    debug: 1,
    requires: 2018110600, // This is the minimum version of the plugin required to work!

    /**
     * Add the wstoken as paramter to an internal url. URL must start with wwwroot.
     * @param identifier site-object or sitehash
     * @param url the url to enhance.
     * @return enhanced url.
     */
    enhanceURL: function(identifier, url) {
        if (MOODLE.debug > 8) console.log('MOODLE.enhanceURL(identifier, url)', identifier, url);
        var site = MOODLE.siteGet(identifier);
        if (empty(url)) return url;
        if (typeof site.wstoken === 'undefined' || empty(site.wstoken.wstoken)) return url;
        if (!url.startsWith(site.wwwroot)) return url;
        if (url.indexOf('?') > 0) {
            url += '&token=' + site.wstoken.wstoken;
        } else {
            url += '?token=' + site.wstoken.wstoken;
        }
        url = url.replace(site.wwwroot + '/pluginfile.php', site.wwwroot + '/webservice/pluginfile.php');
        return url;
    },

    getCoursesScheduled: function(ms, identifier, userid) {
        setTimeout(function(){ MOODLE.getCourses(identifier, userid); }, ms);
    },
    /**
     * get all courses of a site.
     * @param identifier site or wwwroot or sitehash
     * @param userid only required with wwwroot
     */
    getCourses: function(identifier, userid) {
        // Check if we get site from wwwroot | userid
        site = MOODLE.siteGet(identifier, userid);

        if (MOODLE.debug > 1) console.log('MOODLE.getCourses(site, userid)', site, userid);
        CONNECTOR.schedule({
            data: {
                act: 'get_courses',
            },
            identifier: 'moodle_get_courses_' + site.wwwroot + '_' + site.userid,
            site: site,
        });
    },
    /**
     * Does an auto-login to a site and redirects to an url.
     * @param sitehash
     * @param url
     */
    getLaunchURL: function(sitehash, url) {
        var url = btoa(url);
        var site = MOODLE.siteGet(sitehash);
        return site.wwwroot + '/local/eduauth/launch.php?userid=' + site.userid + '&token=' + site.edmtoken + '&appid=' + DB.appid + '&url=' + url;
    },
    /**
     * Retrieve the primary site and entitle one if none is set.
     * @return the site.
     */
    getPrimarySite: function() {
        var primary = DB.getConfig('site_primary', {});
        var primarysite = MOODLE.siteGet(primary.wwwroot, primary.userid);
        if (typeof primarysite === 'undefined') {
            var sites = DB.getConfig('sites', {});
            var keys = Object.keys(sites);
            if (keys.length > 0) {
                var wwwroot = keys[0];
                var keys = Object.keys(sites[wwwroot]);
                if (keys.length > 0) {
                    var userid = keys[0];
                    DB.setConfig('site_primary', { wwwroot: wwwroot, userid: userid });
                    var primarysite = sites[wwwroot][userid];
                }
            }
        }

        if (typeof primarysite !== 'undefined' && typeof primarysite.user !== 'undefined') {
            $('.user-foto').attr('src', MOODLE.enhanceURL(primarysite, primarysite.user.pictureurl));
            $('.user-firstname').html(primarysite.user.firstname);
            $('.user-lastname').html(primarysite.user.lastname);
        } else if (typeof primarysite !== 'undefined'){
            // infinite loop
            //MOODLE.siteMyData(primarysite);
        }

        return primarysite;
    },
    /**
     * List sites on #courses page.
     */
    listSites: function() {
        var sites = MOODLE.sitesSorted();
        var names = Object.keys(sites).sort();

        var sitesettings = $('#sitesettings');
        sitesettings.children(':not(.unremovable)').addClass('flag-for-removal');
        var courses = $('#div-courses');
        courses.children().addClass('flag-for-removal');

        if (names.length == 0) {
            // We have no sites - go to add - page and hide back-button
            $('#connectMoodle div[data-role="header"]>a:first-child').css('display', 'none');
            UI.navigate('#welcome');
        }

        var sitesetting_predecessor;
        var courselist_predecessor;

        for (var a = 0; a < names.length; a++) {
            var site = sites[names[a]];

            var setting = sitesettings.find('.site-' + site.hash);

            if (setting.length === 0) {
                var appendor =
                    $('<fieldset data-role="collapsible" data-inset="false" class="site site-' + site.hash + '" style="margin-top: 8px; margin-bottom: 8px;">').append([
                        $('<legend>').append([
                            $('<span class="siteusername">'),
                            $('<span>').html(' | '),
                            $('<span class="sitename">'),
                            //$('<a href="#" onclick="MOODLE.siteDisconnect(' + site.hash + '); return false;" class="ui-link ui-btn ui-icon-unlink ui-btn-icon-notext ui-corner-all" data-theme="b" data-icon="unlink" data-translate="Disconnect" style="position: absolute; right: 5px; top: 7px; z-index: 999;">').html(language.t('Disconnect')),
                        ]),
                        $('<div data-role="controlgroup">').append([
                            //$('<li class="ui-field-contain">').append([
                                $('<input type="checkbox" id="flip-' + site.hash + '-forum_pushsetting" data-mini="true">'),
                                $('<label for="flip-' + site.hash + '-forum_pushsetting" data-translate="Notification_Forum_Push">').html(language.t('Notification_Forum_Push')),
                            //]),
                            //$('<li class="ui-field-contain">').append([
                                $('<input type="checkbox" id="flip-' + site.hash + '-forum_mailsetting" data-mini="true">'),
                                $('<label for="flip-' + site.hash + '-forum_mailsetting" data-translate="Notification_Forum_Mail">').html(language.t('Notification_Forum_Mail')),
                            //]),
                            //$('<li class="ui-field-contain">').append([
                                $('<input type="checkbox" id="flip-' + site.hash + '-message_pushsetting" data-mini="true">'),
                                $('<label for="flip-' + site.hash + '-message_pushsetting" data-translate="Notification_Message_Push">').html(language.t('Notification_Message_Push')),
                            //]),
                            //$('<li class="ui-field-contain">').append([
                                $('<input type="checkbox" id="flip-' + site.hash + '-message_mailsetting" data-mini="true">'),
                                $('<label for="flip-' + site.hash + '-message_mailsetting" data-translate="Notification_Message_Mail">').html(language.t('Notification_Message_Mail')),
                            //]),
                            $('<a href="#" onclick="MOODLE.siteDisconnect(' + site.hash + '); return false;" data-role="button" class="ui-link ui-btn ui-icon-unlink ui-corner-all" data-theme="b" data-icon="unlink" data-translate="Disconnect">').html(language.t('Disconnect')),
                        ]),
                    ]);
                if (typeof sitesetting_predecessor !== 'undefined') {
                    appendor.insertAfter(sitesetting_predecessor);
                } else {
                    sitesettings.append(appendor);
                }
                sitesetting_predecessor = appendor;
                appendor.trigger('create');
                //sitesettings.find('.site-' + site.hash + ' input').flipswitch();
            }
            sitesettings.find('.site-' + site.hash + ' .sitename').html(site.sitename);
            if(typeof site.user !== 'undefined' && !empty(site.user.username)) sitesettings.find('.site-' + site.hash + ' .siteusername').html(site.user.username);
            //console.debug(site.preferences);
            ['forum_mail', 'forum_push', 'message_mail', 'message_push'].forEach(function(key) {
                var prop = (typeof site.preferences !== 'undefined' && typeof site.preferences[key] !== 'undefined' && site.preferences[key] == 1) ? true : false;
                //console.debug(key, prop);
                sitesettings.find('#flip-' + site.hash + '-' + key + 'setting')
                    .prop('checked', prop) /*.flipswitch('refresh') */
                    .attr('onchange', 'MOODLE.sitePreference(' + site.hash + ', \'' + key + '\', this);');
            })

            sitesettings.find('.site-' + site.hash).removeClass('flag-for-removal');

            var sitediv = courses.children('.site-' + site.hash);
            if (sitediv.length === 0) {
                sitediv = $('<div data-role="collapsible" data-inset="false">').addClass('site-' + site.hash).append([
                    $('<h4>').append([
                        $('<span class="sitename">'),
                        $('<span> (</span>'),
                        $('<span class="siteusername">'),
                        $('<span>)</span>'),
                    ]),
                    $('<ul data-role="listview" class="iconified" data-icon="false" data-split-icon="audio" data-filter="true">').append([ // data-input="#ul-courses-filter"
                        //$('<li data-role="list-divider" class="siteusername">')
                    ]),
                ]);
                if (typeof courselist_predecessor !== 'undefined') {
                    sitediv.insertAfter(courselist_predecessor);
                } else {
                    courses.append(sitediv);
                }
                courselist_predecessor = sitediv;
            }
            sitediv.removeClass('flag-for-removal');
            sitediv.find('.sitename').html(site.sitename);
            if(typeof site.user !== 'undefined' && !empty(site.user.username)) sitediv.find('.siteusername').html(site.user.username);
        }
        sitesettings.children('.flag-for-removal').remove();
        courses.children('.flag-for-removal').remove();

        try { $('#settings, #courses').trigger('create'); } catch(e) {}
        //try { sitesettings.listview('refresh'); } catch(e) {}
        try { $('#settings [data-role="collapsible"]').collapsible('refresh').each(function(){ $(this).find('.ui-collapsible-heading-toggle').addClass('ui-shadow ui-corner-all'); }); } catch(e) {}
        try { courses.find('ul').listview('refresh'); } catch(e) {}
        if (Object.keys(sites).length == 1) {
            $('#courses div[data-role="collapsible"]').collapsible({collapsed: false});
        }

        for (var a = 0; a < names.length; a++) {
            var site = sites[names[a]];
            COURSES.listCourses(site, courses.find('div.site-' + site.hash + ' ul'), false);
        }
    },
    /**
     * Set site to active/inactive state and show notification when inactive.
     * @param identifier wwwroot or site-object or sitehash
     * @param toggleto true if site is active, false if inactive
     * @param userid (optional) only required with wwwroot
     */
    siteActive: function(identifier, toggleto, userid) {
        if (typeof toggleto === 'undefined') return;
        var site = MOODLE.siteGet(identifier, userid);
        site.isactive = toggleto;
        MOODLE.siteSet(site);
        if (!toggleto) {
            $('.loading').remove();
            var url = site.wwwroot.replace('https://', '');
            $('#connectMoodle-url').val(url);
            localStorage.setItem('edmtoken_' + url.hashCode(), site.edmtoken);
            UI.confirm(
                language.t('Login_failed_on_site').replace('{sitename}', site.sitename),
                'MOODLE.siteLogin();'
            );
        }
    },
    /**
     * Disconnect a site.
     */
    siteDisconnect: function(sitehash, confirmed) {
        if (MOODLE.debug > 0) console.log('MOODLE.siteDisconnect(sitehash, confirmed)', sitehash, confirmed);
        var site = MOODLE.siteGet(sitehash);
        if (empty(confirmed)) {
            // Show confirm dialogue.
            UI.confirm(language.t('Really_disconnect_from_site').replace('{sitename}', site.sitename).replace('{username}', site.user.username), 'MOODLE.siteDisconnect(' + sitehash + ', true);');
        } else {
            CONNECTOR.schedule({
                data: {
                    act: 'removeMe',
                },
                identifier: 'moodle_siteremoveme_' + site.wwwroot + '_' + site.userid,
                site: site,
            });
            CENTRAL.disconnectSite(site);
        }
    },
    /**
     * Get site based on url and userid
     * @param identifier wwwroot of site OR sitehash
     * @param userid of us on this site or 0 for first or -1 for all sites.
     * @return the site.
     */
    siteGet: function(identifier, userid) {
        if (MOODLE.debug > 3) console.log('MOODLE.siteGet(identifier, userid)', identifier, userid);
        if (typeof identifier === 'object') return identifier;
        var wwwroot;
        var sites = DB.getConfig('sites', {});
        if(typeof identifier === 'number') {
            // This is a site-hash.
            if (typeof sites.hashcodes === 'undefined' || typeof sites.hashcodes[identifier] === 'undefined') return;
            wwwroot = sites.hashcodes[identifier].wwwroot;
            userid = sites.hashcodes[identifier].userid;
        }
        if (typeof identifier === 'string') {
            // This is an url.
            wwwroot = identifier;
        }
        if (typeof sites[wwwroot] === 'undefined') return;
        if (!empty(userid) && userid > 0) {
            if (typeof sites[wwwroot][userid] === 'undefined') return;
            return sites[wwwroot][userid];
        } else if (userid == -1) {
            // We want the list of sites for this URL.
            return sites[wwwroot];
        } else {
            // return the first site for this url.
            var userids = Object.keys(sites[wwwroot]);
            if (typeof userid === 'undefined' || userids.length === 0) return;
            return sites[wwwroot][userids[0]];
        }
    },
    /**
     * Get site based on url and userid
     * @param identifier site-object or wwwroot or sitehash
     * @param userid (optional) userid only required with wwwroot
     * @param o (optional) overwrite sitedynamic with this object
     * @return the dynamic content of site or empty object.
     */
    siteGetDynamic: function(identifier, userid, o) {
        var site = MOODLE.siteGet(identifier, userid);
        var sitesdynamic = DB.getConfig('sitesdynamic', {});
        if (typeof sitesdynamic[site.hash] === 'undefined') sitesdynamic[site.hash] = {};
        if (typeof o !== 'undefined') {
            sitesdynamic[site.hash] = o;
            DB.setConfig('sitesdynamic', sitesdynamic);
        }
        return sitesdynamic[site.hash];
    },
    siteLogin: function() {
        var url = 'https://' + $('#connectMoodle-url').val().replace(/\/+$/, "");;
        // the token is generated for each url once and removed once it is redeemed.
        var edmtoken = localStorage.getItem('edmtoken_' + url.hashCode());
        if (empty(edmtoken)) {
            var edmtoken = uuidv4(); //Math.random().toString(36).replace(/[^a-z]+/g, '');
            localStorage.setItem('edmtoken_' + url.hashCode(), edmtoken);
        }
        urllaunch = url + '/local/eduauth/login.php?act=login&token=' + edmtoken + '&appid=' + DB.appid;
        console.log(' => opening ', urllaunch);
        iab = window.open(urllaunch, '_blank', 'location=yes,hidenavigationbuttons=yes,hideurlbar=yes,toolbar=no,clearsessioncache=yes');
        iab.addEventListener('exit', function(event) {
            if (typeof MOODLE.currenttimeout !== 'undefined') {
                console.log('=> Clearing Timeout');
                clearTimeout(MOODLE.currenttimeout);
                delete(MOODLE.currenttimeout);
            }
        });
        var testlogin = function() {
            console.log('=> Check if login is finished');
            $.get(url + '/local/eduauth/login.php?act=getuser&token=' + edmtoken + '&appid=' + DB.appid,
                function(data) {
                    console.log('=> Result of getuser', data);
                    var o = JSON.parse(data);
                    if (!empty(o.token) && !empty(o.userid) && o.userid > 1) {
                        o.edmtoken = o.token;
                        localStorage.removeItem('edmtoken_' + url.hashCode());
                        if (typeof iab !== 'undefined') iab.close();
                        var sites = DB.getConfig('sites', {});
                        var firstsite = Object.keys(sites).length === 0;
                        if (typeof sites[o.wwwroot] === 'undefined') sites[o.wwwroot] = {};
                        o.isactive = true;
                        sites[o.wwwroot][o.userid] = o;
                        o.hash = (o.wwwroot + ':' + o.userid).hashCode();
                        sites.hashcodes = sites.hashcodes || {};
                        sites.hashcodes[o.hash] = { wwwroot: o.wwwroot, userid: o.userid };
                        DB.setConfig('sites', sites);
                        CENTRAL.announceSite(o);
                    } else {
                        console.log('=> Re-schedule testlogin');
                        MOODLE.currenttimeout = setTimeout(testlogin, 500);
                    }
                }
            ).fail(function(){
                console.log('=> Re-schedule testlogin after fail');
                MOODLE.currenttimeout = setTimeout(testlogin, 500);
            });
        };
        MOODLE.currenttimeout = setTimeout(testlogin, 500);
    },
    /**
     * Load personal data from site.
     * @param site site or wwwroot or sitehash.
     * @param userid the userid on the site.
     */
    siteMyData: function(site, userid) {
        // Check if we get site from wwwroot | userid
        if (typeof site === 'string') { site = MOODLE.siteGet(site, userid); }
        if (typeof site === 'number') { site = MOODLE.siteGet(site); }
        if (typeof site !== 'undefined') {
            CONNECTOR.schedule({
                data: {
                    act: 'myData'
                },
                identifier: 'moodle_sitemydata_' + site.wwwroot + '_' + site.userid,
                site: site,
            });
        }
    },
    /**
     * Toggles a preferences on a site.
     */
    sitePreference: function(sitehash, preference, control) {
        if (MOODLE.debug > 0) console.log('MOODLE.sitePreference(sitehash, preference, control)', sitehash, preference, control);
        $(control).css('filter', 'blur(1.5px)');
        var site = MOODLE.siteGet(+sitehash);
        CONNECTOR.schedule({
            data: {
                act: 'setPreference',
                preference: preference,
                value: $(control).prop('checked') ? 'on' : 'off'
            },
            identifier: 'moodle_sitepreference_' + sitehash + '_' + preference,
            payload: {
                control: $(control).attr('id')
            },
            site: site,
        });
    },
    /**
     * Remove all contents from a moodle-site.
     * @param site
     */
    siteRemoveContents: function(site) {
        site.hash = (site.wwwroot + ':' + site.userid).hashCode();
        if (MOODLE.debug > 0) console.log('MOODLE.siteRemoveContents(site)', site);
        var t = app.db.transaction(['discussions', 'posts', 'conversations', 'messages'], 'readwrite');
        var dstore = t.objectStore('discussions');
        var pstore = t.objectStore('posts');
        var cstore = t.objectStore('conversations');
        var mstore = t.objectStore('messages');

        var range = IDBKeyRange.bound([site.hash, 0],[site.hash, LIB.k9]);
        var ddestroy = dstore.delete(range);
        var pdestroy = pstore.delete(range);
        var cdestroy = cstore.delete(range);
        var mdestroy = mstore.delete(range);
        // Remove anything in the DOM that is connected to this site.
        $('.site-' + site.hash).remove();
        POSTS.listStream($('#ul-stream li').length);
        // Message stream has to be rebuilt completly.
        $('#ul-conversations').empty();
        var am = ($('#ul-conversations li').length > 30) ? $('#ul-conversations li').length : 30;
        CONVERSATIONS.listStream(am);
    },
    /**
     * Store a site.
     * @param site.
     * @param remove true if we should remove the site.
     */
    siteSet: function(site, remove) {
        if (MOODLE.debug > 0) { console.log('MOODLE.siteSet(site, remove)', site, remove); }
        var sites = DB.getConfig('sites', {});
        var sitesdynamic = DB.getConfig('sitesdynamic', {});
        if (!empty(remove) && remove) {
            MOODLE.siteRemoveContents(site);
            delete(sitesdynamic[site.hashcode]);
            if (typeof sites[site.wwwroot] !== 'undefined') {
                delete(sites[site.wwwroot][site.userid]);
                if (Object.keys(sites[site.wwwroot]) == 0) {
                    delete(sites[site.wwwroot]);
                }
            }
            delete(sites.hashcodes[site.hash]);
        } else {
            site.hash = (site.wwwroot + ':' + site.userid).hashCode();
            if (typeof sites[site.wwwroot] === 'undefined') sites[site.wwwroot] = {};
            sites[site.wwwroot][site.userid] = site;
            MOODLE.siteWSToken(site.wwwroot, site.userid);
            if (typeof sitesdynamic[site.wwwroot] === 'undefined') sitesdynamic[site.wwwroot] = {};
            sitesdynamic[site.wwwroot][site.userid] = {
                courses: {},
                forums: {},
                discussions: {},
            };
            if (typeof sites.hashcodes === 'undefined') sites.hashcodes = {};
            sites.hashcodes[site.hash] = { wwwroot: site.wwwroot, userid: site.userid };
        }
        DB.setConfig('sites', sites);
        DB.setConfig('sitesdynamic', sitesdynamic);
        MOODLE.getPrimarySite();
        MOODLE.listSites();
    },
    /**
     * Check if a site has the plugin installed.
     */
    siteTest: function() {
        if (MOODLE.debug > 8) { console.log('MOODLE.siteTest()'); }
        $('#connectMoodle-login').addClass('ui-state-disabled');
        $('#moodle_but_no_messenger').css('opacity', '0');
        var url = $('#connectMoodle-url').val().replace(/\/+$/, "");
        if (url.indexOf('.') === -1) return false;
        if (url.length < 5) return false;
        url = 'https://' + url;
        if (MOODLE.debug > 0) { console.log('=> check Site', url + '/local/edumessenger/check.php'); }
        MOODLE.currentCheckURL = url;
        $.get(url + '/local/edumessenger/check.php',
            function(data) {
                if (MOODLE.currentCheckURL == url) {
                    if (MOODLE.debug > 5) { console.log('=> Result of check from ', url, data); }
                    if (data >= MOODLE.requires) {
                        $('#connectMoodle-login').removeClass('ui-state-disabled');
                    } else {
                        $('#connectMoodle-login').addClass('ui-state-disabled');
                    }
                } else {
                    if (MOODLE.debug > 5) { console.log('=> Ignoring a result as URL to check has changed from ', url, ' to ', MOODLE.currentCheckURL); }
                }
            }
        ).fail(function(){
            if (MOODLE.currentCheckURL == url) {
                if (MOODLE.debug > 5) { console.log('There is no messenger-plugin, testing for login/token.php-Script at site ', url); }
                $.get(url + '/login/token.php',
                    function(data) {
                        if (MOODLE.debug > 5) { console.log('=> Yes, there is a login/token.php-Script at site ', url); }
                        $('#moodle_but_no_messenger').css('opacity', '1');
                    }
                );
            } else {
                if (MOODLE.debug > 5) { console.log('Request for ', url, ' has been aborted as required url changed to', MOODLE.currentCheckURL); }
            }
        });
        return false;
    },
    /**
     * Get all sites sorted alphabetically.
     * @return list of sites in alphabetical order.
     */
    sitesSorted: function() {
        var sites = DB.getConfig('sites', {});
        var sortedsites = {};
        var wwwroots = Object.keys(sites);
        for (var a = 0; a < wwwroots.length; a++) {
            if (wwwroots[a] == 'hashcodes') continue;
            var userids = Object.keys(sites[wwwroots[a]]);
            for (var b = 0; b < userids.length; b++) {
                var site = sites[wwwroots[a]][userids[b]];
                var uid = (typeof site.user !== 'undefined') ? site.user.username : site.userid;
                sortedsites[site.sitename.toUpperCase() + ':' + uid] = site;
            }
        }
        return sortedsites;
    },
    /**
     * Load a moodle mobile wstoken (only if the existing one is at least 1 week old)
     * @param site site or wwwroot.
     * @param userid the userid on the site.
     */
    siteWSToken: function(site, userid) {
        // Check if we get site from wwwroot | userid
        if (typeof site === 'string') { site = MOODLE.siteGet(site, userid); }
        var gettoken = false;

        var curdate = Math.round(new Date().getTime() / 1000);
        var lastweek = curdate - 7 * 24 * 60 * 60;

        if (empty(site.wstoken) || empty(site.wstoken.timecreated) || site.wstoken.timecreated < lastweek) {
            CONNECTOR.schedule({
                data: {
                    act: 'wstoken',
                    timecreated: curdate
                },
                identifier: 'moodle_wstoken_' + site.wwwroot + '_' + site.userid,
                site: site,
            });
        }
    },
}
