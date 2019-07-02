/**
** This script handles all Ajax-Queries to eduMessenger-Central or Moodle-Instances
** and analyzes the results
** For HTTP-Instances it redirects over a Proxy at eduMessenger-Central
**/

var CONNECTOR = {
	debug: 3,
	request_nr: 0,
	requests_current: 0,
	REQUESTS_MAXIMUM: 3,
	/**
	** Retrieves the highest requestId from objectStore requests and sets CONNECTOR.requestId
	** Enables an interval to start requests based on a timer
	**/
	init: function() {
		if (CONNECTOR.debug > 1) console.log('CONNECTOR.init()');
		app.db.transaction('requests','readonly').objectStore('requests').index('requestId').openCursor(undefined,'prev').onsuccess = function(event){
			if(event.target.result) CONNECTOR.request_nr = event.target.result.value.requestId;
			//setInterval(function(){ CONNECTOR.next(); },500);
		}
	},
	/**
	** Schedule an ajax-query by storing it into our database
	** @param o Object containing all necessary parameters. We treat:
	**		type Type of request ('central' or 'direct')
	**		data Data that will be sent
	**		identifier (optional) Identifies the request to avoid duplicated requests for the same
	**		payload (optional) Additional Data that can be used for analyzing results, but will not be sent
	**			If Items are of type 'direct' they need a payload.url to determine the target
	** @param priority Send this request immediatley without considering REQUESTS_MAXIMUM
	**/
	schedule: function(o, priority){
        console.log('CONNECTOR.schedule(o, priority)', o, priority);
		if(o===undefined) return;
        if (typeof o.site !== 'undefined' && typeof o.site.isactive !== 'undefined' && !o.site.isactive) {
            console.error('===> ATTENTION, the site is inactive. Call will not be sent', o);
            if (priority) {
                MOODLE.siteActive(o.site, false);
            }
            return;
        }
		if(priority===undefined) priority = false;
		if(o.payload===undefined) o.payload = {};
		o.requestId = CONNECTOR.request_nr++;
        if (!o.level) o.level = app.level.unknown;
		if (priority){
			CONNECTOR.connect(o);
			if (o.identifier !== undefined) {
				var rstore = app.db.transaction('requests','readwrite').objectStore('requests');
				rstore.index('identifier').openCursor(IDBKeyRange.only(o.identifier)).onsuccess = function(event){
					if(event.target.result) {
						if (CONNECTOR.debug > 2) console.log('Schedule with priority removed elder request');
						rstore.delete(event.target.result.primaryKey);
						event.target.result.continue();
					}
				}
			}
		} else {
			if (typeof o.identifier !== 'undefined') {
				app.db.transaction('requests','readonly').objectStore('requests').index('identifier').openCursor(IDBKeyRange.only(o.identifier)).onsuccess = function(event){
					if (event.target.result) { if (CONNECTOR.debug > 1) console.log('There is already a request for identifier '+o.identifier); CONNECTOR.next(); }
					else app.db.transaction('requests','readwrite').objectStore('requests').put(o).onsuccess = function(){ CONNECTOR.next(); };
				}
			} else {
				app.db.transaction('requests','readwrite').objectStore('requests').put(o).onsuccess = function(){ CONNECTOR.next(); };
			}
		}
	},
	/**
	** Determines the next request(s) from Database until the maximum amount of parallel requests is reached
	** calls CONNECTOR.connect for each request
	**/
	next: function(){
        if (CONNECTOR.debug > 10) console.log('CONNECTOR.next()');
		if (CONNECTOR.requests_current >= CONNECTOR.REQUESTS_MAXIMUM) {
            if (CONNECTOR.debug > 10) console.log('-> Too many requests, abort');
            return;
        }
        var store = app.db.transaction('requests', 'readwrite').objectStore('requests');
		store.index('level_requestId').openCursor().onsuccess = function(event){
			var cursor = event.target.result;
			if (cursor && CONNECTOR.requests_current < CONNECTOR.REQUESTS_MAXIMUM) {
                CONNECTOR.requests_current++;
                store.delete(cursor.primaryKey).onsuccess = function(){
                    var o = Object.create(cursor.value);
                    CONNECTOR.connect(o);
                    cursor.continue();
                }
			} else if (CONNECTOR.requests_current >= CONNECTOR.REQUESTS_MAXIMUM) {
                if (CONNECTOR.debug > 5) console.debug('Reached maximum of ' + CONNECTOR.REQUESTS_MAXIMUM + ' Requests');
            }
		}
	},
	/**
	** Connects to Moodle-Instance or Central
	**/
	connect: function(o){
        console.log('CONNECTOR.connect(o)', o);
        var url = app.URL_CENTRAL + '/connect.php?uuid=' + CENTRAL.device.uuid;
        var data = {
            //data: o.data,
            data: JSON.stringify(o.data)
        };
        if (typeof o.site !== 'undefined' && !empty(o.site.wwwroot)) {
            url = o.site.wwwroot + '/local/edumessenger/connect.php';
            var site = MOODLE.siteGet(o.site.wwwroot, o.site.userid);
            if (typeof site === 'undefined' || empty(site.edmtoken)) {
                // This site seems to have been removed.
                // We delete the schedule, call next and return.
                CONNECTOR.requests_current--;
                CONNECTOR.next();
                return;
            }
            data.edmtoken = site.edmtoken;
            data.userid = site.userid;
        }

        var blockSend = false;

		if(CONNECTOR.debug>2) console.log('> RequestId #' + o.requestId + ': ' + url, o, data);

        if (!blockSend)
            $.ajax({
                url: url,
                method: 'POST',
                data: data,
            }).always(function(){
                CONNECTOR.requests_current--;
                setTimeout(function() { CONNECTOR.next(); }, 50);
            }).done(function(res){
                try { res = JSON.parse(res); } catch(e){}
                if(CONNECTOR.debug>2) console.log('< RequestId #' + o.requestId, res);
				o.result = res;
				if (typeof res.errorcode !== 'undefined' && res.errorcode === 'invalidtoken') {
					var instanceid = (o.payload.instance.instanceid || o.payload.instanceid || o.data.instanceid || false);
					if (!instanceid) {
						console.error('ATTENTION: NO INSTANCEID TO THIS REQUEST FOUND')
						console.error(JSON.parse(JSON.stringify(o.data)));
						console.error(JSON.parse(JSON.stringify(o.payload)));
						console.error(JSON.parse(JSON.stringify(o.result)));
					} else {
						var store = app.db.transaction('instances', 'readwrite').objectStore('instances');
						store.get(instanceid).onsuccess = function(event){
							var instance = event.target.result;
							if (instance) {
								instance.flaginvalidtoken = true;
								store.put(instance).onsuccess = function(event) {
									if (typeof UI.errorinvalidtokenshown === 'undefined') {
										UI.errorinvalidtokenshown = true;
										UI.alert('One or more tokens have been deprecated. Please check your connection to services!');
										INSTANCES.list();
										UI.navigate('#instances');
									}
								};
							} else {
								console.error('ATTENTION: NO INSTANCE FOUND TO INSTANCEID ' + instanceid);
							}
						};
					}
				} else {
					CONNECTOR.result(o);
				}
            }).fail(function(jqXHR, textStatus){
                if(CONNECTOR.debug>2) console.error('* RequestId #' + o.requestId, textStatus);
            });
        else {
            console.log('Request ' + o.requestId + ' was blocked');
            CONNECTOR.requests_current--;
            CONNECTOR.next();
        }
	},
	result: function(o){
        if (typeof o.site !== 'undefined') {
            // Site may have changed in the meanwhile - therefore we load it fresh.
            var site = MOODLE.siteGet(o.site.wwwroot, o.site.userid);

            if (!empty(o.result.error) && o.result.error == 'invalid_login') {
                MOODLE.siteActive(site, false);
                return;
            }
            if (o.data.act == 'create_message') {
                $('#message-add').removeAttr('disabled');
                if (typeof o.result.message !== 'undefined') {
                    CONVERSATIONS.storeMessages(site, [o.result.message]);
                    $('#message-add').val('');
                }
                if (typeof o.result.error !== 'undefined') {
                    UI.alert(o.result.error);
                }
            }
            if (o.data.act == 'get_conversation_messages') {
                if (typeof o.result.messages !== 'undefined') {
                    CONVERSATIONS.storeMessages(site, o.result.messages);
                }
            }
            if (o.data.act == 'get_conversations') {
                if (typeof o.result.conversations !== 'undefined') {
                    CONVERSATIONS.store(site, o.result.conversations);
                }
            }
            if (o.data.act == 'get_course_structure') {
                if (typeof o.result.structure !== 'undefined') {
                    site.courses[o.data.courseid].structure = o.result.structure;
                    MOODLE.siteSet(site);
                    setTimeout(400, function() { COURSES.listCourse(site, o.data.courseid, true); });
                }
            }
            if (o.data.act == 'get_courses') {
                if (typeof o.result.courses !== 'undefined') {
                    site.courses = o.result.courses;
                    MOODLE.siteSet(site);
                    MOODLE.listSites();
                }
            }
            if (o.data.act == 'get_discussions') {
                if (typeof o.result.discussions !== 'undefined') {
                    DISCUSSIONS.store(site, o.result.discussions, o.payload.opendiscussionid);
                }
            }
            if (o.data.act == 'get_posts') {
                var course = site.courses[o.data.courseid];
                var forum = course.forums[o.data.forumid];
                var discussion = o.result.discussion;
                if (typeof discussion !== 'undefined') {
                    DISCUSSIONS.store(site, [discussion]);
                }
                if (typeof o.result.posts !== 'undefined') {
                    if (typeof discussion === 'undefined') {
                        app.db.transaction('discussions', 'readonly').objectStore('discussions').get([wwwroot, o.data.discussionid]).onsuccess = function(event) {
                            var discussion = event.target.result;
                            if (discussion) {
                                POSTS.store(site, o.result.posts);
                            } else {
                                UI.alert(language.t('Unkown_error_occurred'));
                            }
                        }
                    } else {
                        POSTS.store(site, o.result.posts);
                    }
                }
            }
            if (o.data.act == 'get_stream') {
                if (typeof o.result.posts !== 'undefined') {
                    POSTS.store(site, o.result.posts, o.payload);
                    if (typeof o.result.limit !== 'undefined') {
                        // We only automatically refresh if we are not getting behind 3 months
                        // and the last call returned the maximum of possible items (=limit).
                        var d = new Date();
                        d.setMonth(d.getMonth() - 3);
                        var keys = Object.keys(o.result.posts);
                        var lastpost = o.result.posts[keys[keys.length - 1]];
                        if (lastpost.modified > Math.floor(d.getTime() / 1000)
                            && o.result.limit == Object.keys(o.result.posts).length) {
                            POSTS.loadStream(site.hash, o.result.lastknownmodified, o.result.offset + Object.keys(o.result.posts).length, o.result.limit, o.result.ordering);
                        }
                    }
                } else {
                    // Error occurred.
                    UI.alert(language.t('Unkown_error_occurred'));
                }
            }
            if (o.data.act == 'myData') {
                if (typeof o.result.user !== 'undefined') {
                    site.isactive = true;
                    site.user = o.result.user;
                }
                if (typeof o.result.preferences !== 'undefined') {
                    site.preferences = o.result.preferences;
                }
                MOODLE.siteSet(site);
            }
            if (o.data.act == 'setPreference') {
                if (empty(o.result.error)) {
                    $(o.payload.control).css('filter', 'none');
                    if (typeof site.preferences === 'undefined') {
                        site.preferences = {};
                    }
                    site.preferences[o.data.preference] = (o.data.value == 'on') ? 1 : 0;
                    MOODLE.siteSet(site);
                }
            }
            if (o.data.act == 'wstoken' && !empty(o.result.wstoken)) {
                site.wstoken = {
                    wstoken: o.result.wstoken,
                    timecreated: o.data.timecreated,
                }
                MOODLE.siteSet(site);
            }
        } else {
            if (o.data.act == 'announceDevice') {
                if (!empty(o.result.uuid) && o.result.uuid == o.data.uuid) {
                    console.log('Device announced successfully');
                }
            }
            if (o.data.act == 'announceSite') {
                if (empty(o.result.error)) {
                    MOODLE.siteSet(o.data.site);
                    MOODLE.siteMyData(o.data.site);
                    MOODLE.getCourses(o.data.site);
                    POSTS.loadStream(o.data.site.hash, undefined, undefined, undefined, 'DESC');
                    CONVERSATIONS.getConversations(o.data.site);
                    var sites = DB.getConfig('sites', {});
                    var firstsite = Object.keys(sites).length === 0;
                    if (firstsite) {
                        UI.init();
                        // Show back button on connectMoodle Page
                        $('#connectMoodle div[data-role="header"]>a:first-child').css('display', 'block');
                    }
                    UI.navigate('#settings');
                }
            }
            if (o.data.act == 'disconnectDevice') {
                if (!empty(o.result.status) && o.result.status == 'ok') {
                    DB.reset(true);
                }
            }
            if (o.data.act == 'disconnectSite') {
                if (!empty(o.result.status) && o.result.status == 'ok') {
                    MOODLE.siteSet(o.data.site, true);
                }
            }
        }
	},
	handleOpenURL: function(url) {
		console.log("received url: " + url);
		var token = '';
		if(url.startsWith('eduvidual://?')) {
			token = url.replace('eduvidual://?','');
		}
		if(url.startsWith(app.URL_WEBAPP+'/?')) {
            console.log('Getting token from webapp');
			token = url.replace(app.URL_WEBAPP+'/?','');
		}
		if(token!=''){
			token = token.split('&');
			CONNECTOR.analyzeURLToken(token);
		}
	},
    /**
     * Analyzes a token that was sent by url.
     * Stores the user token if data seems valid.
     * @param token array with two indices: 0 ... userid, 1 ... token
     */
	analyzeURLToken: function(token){
        if (token.length !== 2) return;
        var userid = token[0];
        var token = token[1];
        if (token.indexOf('#') > 0) {
            token = token.split('#');
            token = token[0];
        }
        console.log('Got UserID and token', userid, token);

        if (userid > 0 && token != '') {
            USER.createUser(userid, token);
            /*
            localStorage.setItem('tmp_store_auth_userid', userid);
            localStorage.setItem('tmp_store_auth_token', token);
            if (isWebApp) {
                top.location.href = app.URL_WEBAPP;
            } else {
                top.location.reload();
            }
            */
        }
	},
}


function handleOpenURL(url) {
    console.log('Handling URL: '+url);
  setTimeout(function() {
    CONNECTOR.handleOpenURL(url);
  }, 0);
}
