// https://www.npmjs.com/package/cordova-plugin-native-keyboard
var POSTS = {
    debug: 10,
    /**
     * Sets or checks if a forum is currently shown.
     */
    active: function(sitehash, discussionid, set) {
        if (!empty(set) && set) {
            $('#posts').attr('data-sitehash', sitehash).attr('data-discussionid', discussionid);
            return true;
        }
        return $('#posts').attr('data-sitehash') == sitehash && $('#posts').attr('data-discussionid') == discussionid;
    },
    /**
     * Load the latest post from database and fill some html field with this data.
     * @param sitehash of site
     * @param groupid groupid to filter posts for.
     * @param discussionid discussionid we want to load posts for.
     * @param li html element we want to enhance.
     * @param fieldmapping map specific fields of post-object to html-classes.
     */
    fillLastPostData: function(sitehash, courseid, forumid, groupid, discussionid, li, fieldmapping) {
        var site = MOODLE.siteGet(sitehash);
        var index = 'sitehash_discussionid_modified';
        var range = IDBKeyRange.bound([sitehash, discussionid, 0], [sitehash, discussionid, LIB.k9]);
        groupid = groupid || -1;
        if (groupid > -1) {
            index = 'sitehash_discussionid_groupid_modified';
            range = IDBKeyRange.bound([sitehash, discussionid, groupid, 0], [sitehash, discussionid, groupid, LIB.k9]);
        }
        app.db.transaction('posts', 'readonly').objectStore('posts').index(index).get(range, 'prev').onsuccess = function(event) {
            var post = event.target.result;
            if (post) {
                if (typeof fieldmapping !== 'undefined') {
                    Object.keys(fieldmapping).forEach(function(key) {
                        $(li).find('.' + fieldmapping[key]).html(LIB.stripHTML(post[key]) || language.t('Unknown'));
                    });
                } else {
                    Object.keys(post).forEach(function(key) {
                        $(li).find('.' + key).html(LIB.stripHTML(post[key]));
                    });
                }
            } else {
                // There is no single post for this discussion? That is impossible!
                // This will not reload the UI when showing discussions, but fixes this issue for next view.
                POSTS.load(sitehash, courseid, forumid, discussionid);
            }
        }
    },
    /**
     * List posts of a certain discussion.
     */
    list: function (sitehash, courseid, forumid, discussionid, groupid, navigate) {
        navigate = navigate || false;
        if (POSTS.debug > 0) { console.log('POSTS.list(sitehash, courseid, forumid, discussionid, groupid, navigate)', sitehash, courseid, forumid, discussionid, groupid, navigate); }
        if (!POSTS.active(sitehash, discussionid)) {
            if (POSTS.debug > 0) { console.log(' => ABORTED, not active'); }
            return;
        }
        var site = MOODLE.siteGet(sitehash);
        var course = site.courses[courseid];
        var forum = course.forums[forumid];
        $('#posts-panel-right .link-forum').attr('onclick', 'DISCUSSIONS.show(' + site.hash + ', ' + forum.course + ', ' + forum.id + ', 1); return false;');
        $('#posts-panel-right .link-course').attr('onclick', 'if (COURSES.listCourse(' + site.hash + ', ' + forum.course + ')) { UI.navigate("#course"); }; return false;');

        // ATTENTION, check if this forum is accessible with other connected sites. If it is so provide a popup via a button on the right upper corner.
        // This also applies to posts. (and messages?)

        setTimeout(function(){
            if (!empty(forum.cm.groupmode) && forum.cm.groupmode > 0) {
                $('.group-selector-wrapper').css('display', 'block');
                var sel = $('.group-selector:not([data-forforum="' + forum.id + '"])').empty();
                if (!empty(forum.canaccessallgroups) && forum.canaccessallgroups) {
                    $(sel).append($('<option value="-1">').html(language.t('All_groups')));
                }
                Object.keys(forum.groups).forEach(function(groupid){
                    var group = forum.groups[groupid];
                    $(sel).append($('<option value="' + group.id + '">').html(group.name));
                });
                $('.group-selector:not([data-forcourse="' + course.id + '"])').attr('data-forforum', forum.id);
            } else {
                $('.group-selector-wrapper').css('display', 'none');
            }
            try { $('.group-selector').each(function() { $(this).selectmenu('refresh'); }); } catch(e) {}
        }, 500);

        var predecessor = undefined;
        var div = $('#div-posts');
        div.children('div:not(.loading)').addClass('flag-removable');
        var index = 'sitehash_discussionid_modified';
        var range = IDBKeyRange.bound([sitehash, discussionid, 0], [sitehash, discussionid, LIB.k9]);
        groupid = groupid || -1;
        if (groupid > -1) {
            index = 'sitehash_discussionid_groupid_modified';
            range = IDBKeyRange.bound([sitehash, discussionid, groupid, 0], [sitehash, discussionid, groupid, LIB.k9]);
        }
        LIB.coloringStart();
        app.db.transaction('posts', 'readonly').objectStore('posts').index(index).openCursor(range).onsuccess = function(event){
            var cursor = event.target.result;
            if (cursor) {
                var post = cursor.value;
                var userpictureurl = !empty(post.userpictureurl) ? MOODLE.enhanceURL(site, post.userpictureurl) : '';

                var divP = $(div).find('.site-' + site.hash + '.post-' + post.postid);
                if (divP.length == 0) {
                    divP = $('<div>').append([
                        $('<div>').append([
                            $('<a>').append([
                                $('<img class="userpicture">').attr('src', userpictureurl),
                            ]).attr('href', '#').attr('onclick', 'MESSAGES.listMessages(' + sitehash + ', ' + post.userid + ',true); $("#messages .ui-header h1").html($(this).attr("data-name"));').attr('data-name', post.userfullname),
                            $('<p class="author">'),
                            $('<p class="datetime">'),
                            $('<p class="message">'),
                            $('<div class="attachments">'),
                            $('<a class="score">'),
                        ]).attr('style','border: 2px solid rgba(' + LIB.coloringColor(post.userid).join(',') + ');')
                          .addClass((site.userid == post.userid) ? 'post-self' : 'post-other'),
                    ]).addClass('site-' + site.hash)
                      .addClass('post-' + post.postid)
                      .addClass('post ui-scroll-element')
                      .css({ overflow: 'hidden', position: 'relative' });
                    if (typeof predecessor === 'undefined') {
                        div.append(divP);
                    } else {
                        divP.insertAfter(predecessor);
                    }
                }
                divP.removeClass('flag-removable');
                $(divP).find('.author').html(post.userfullname || language.t('Unknown'));
                $(divP).find('.datetime').html(UI.ts2time(post.created, true));
                $(divP).find('.message').html(LIB.injectHTML(post.message, site));
                //$(divP).find('.attachments').html(post.message);

                // Update this section
                if(typeof post.rating !== 'undefined' && post.rating.canviewaggregate){
                    $(divP).find('.score').
                        attr('data-rel', 'popup').
                        attr('data-position-to', 'window').
                        attr('data-transition', 'pop').
                        attr('data-ratingname', ratingname).
                        attr('data-assessed_type', assessed_type).
                        attr('data-rating', ratingpoints).
                        attr('onclick', '$("#popupGrade").attr("data-postid", ' + post.postid + ').attr("data-iuserid", ' + post.userid + '); $("#popupGrade #post-grade-slider").val($(this).attr("data-rating")).slider("refresh"); $("#popupGrade #post-grade-select").val($(this).attr("data-rating")).selectmenu("refresh"); $("#popupGradeInfo .assessed_type").html($(this).attr("data-assessed_type")); $("#popupGradeInfo .post-grade-score").html($(this).attr("data-rating")); $("#popupGradeInfo .post-grade-grade").html($(this).attr("data-ratingname"));').
                        html(((typeof post.rating !== 'undefined' && post.rating.aggregate != null)?((typeof post.scales !== 'undefined' && !post.scales[0].isnumeric)?ratingname:post.rating.aggregate) + ' / ' + post.rating.count:'-'));
                } else {
                    $(divP).find('.score').css('display', 'none');
                }

                predecessor = divP;
                cursor.continue();
            } else {
                $(div).children('.flag-removable').remove();
                if (navigate) {
                    UI.navigate('#posts');
                }
            }
        };
    },
    /**
     * Show the latest discussion-posts through all sites. Only show one post per discussion.
     * @param maximum of items to show (grows when bouncing)
     * @param navigate whether or not to navigate to stream after listing
     * @param callbybounce wheter or not function was called by user bouncing end of list.
     */
    listStream: function(maximum, navigate, callbybounce) {
        maximum = maximum || 30;
        navigate = navigate || false;
        callbybounce = callbybounce || false;
        if (POSTS.debug > 0) { console.log('POSTS.listStream(maximum)', maximum); }
        var ul = $('#ul-stream');
        $(ul).children().addClass('flag-removable');

        var blocker = {};
        var counter = 0;
        var predecessor = undefined;

        app.db.transaction('posts', 'readonly').objectStore('posts').index('modified').openCursor(undefined, 'prev').onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                if (counter > maximum) { cursor.continue(); return; }
                var post = cursor.value;
                var site = MOODLE.siteGet(post.sitehash);
                var wwwroothash = site.wwwroot.hashCode();

                if (typeof post.deleted === 'undefined' || post.deleted == 0) {
                    if (typeof blocker[wwwroothash] === 'undefined') blocker[wwwroothash] = {};
                    if (typeof blocker[wwwroothash][post.discussionid] !== 'undefined') { cursor.continue(); return; }
                    counter++;
                    blocker[wwwroothash][post.discussionid] = true;

                    var userpictureurl = !empty(post.userpictureurl) ? MOODLE.enhanceURL(site, post.userpictureurl) : '';

                    var li = $(ul).children('.wwwroothash-' + wwwroothash + '.discussion-' + post.discussionid);
                    if (li.length === 0) {
                        li = $('<li>').append([
                            $('<a>').append([
                                $('<img class="userpicture" alt="User">'),
                                $('<h3>').append([
                                    $('<span class="author">'),
                                    //$('<span>').html(' > '),
                                    //$('<span class="subject">'),
                                ]),
                                $('<p class="message">'),
                                $('<span class="ui-li-count datetime">'),
                            ]).attr('href', '#').attr('onclick', 'POSTS.show("' + site.wwwroot + '", 0, ' + post.courseid + ', ' + post.forumid + ', ' + post.discussionid + ', 1);'),
                        ]).addClass('sitehash-' + post.sitehash)
                          .addClass('wwwroothash-' + wwwroothash)
                          .addClass('discussion-' + post.discussionid)
                          .attr('data-modified', post.modified);
                        if (typeof predecessor === 'undefined') {
                            ul.append(li);
                        } else {
                            if (predecessor.attr('data-modified') != li.prev().attr('data-modified')) {
                                li.insertAfter(predecessor);
                            }
                        }
                        try { $(li).trigger('create'); } catch(e) {}
                    }
                    predecessor = li;
                    li.removeClass('flag-removable');
                    $(li).find('.userpicture').attr('src', userpictureurl).attr('alt', post.userfullname || language.t('Unknown'));
                    $(li).find('.message').html(LIB.stripHTML(post.message));
                    $(li).find('.author').html(post.userfullname);
                    $(li).find('.datetime').html(UI.ts2time(post.created, 'verbal'));
                    DISCUSSIONS.fillDiscussionData(post.sitehash, post.discussionid, li, { subject: 'subject' });
                }

                cursor.continue();
            } else {
                if (navigate) {
                    UI.navigate((counter > 0) ? '#stream' : '#courses');
                }
                $(ul).children('.flag-removable').remove();
                try { $(ul).listview('refresh'); } catch(e) {}
                $(document).off('scroll').scroll(function() {
                    if ($(window).scrollTop() >= $(document).height() - $(window).height() - 100) {
                        POSTS.listStream(maximum + 30);
                    }
                });
                if (callbybounce && counter < maximum) {
                    var sites = DB.getConfig('sites');
                    sites.forEach(function(wwwroot) {
                        sites[wwwroot].forEach(function(site) {
                            if (!empty(site.hash)) {
                                var priorto = $('#ul-stream .sitehash-' + site.hash).attr('data-modified') || Math.floor((new Date()).getTime() / 1000);
                                POSTS.loadStream(site.hash, 0, 0, undefined, 'DESC', priorto, { maximum: maximum + 30 });
                            }
                        });
                    });
                }
            }
        }
    },
    load: function(sitehash, courseid, forumid, discussionid) {
        if (POSTS.debug > 0) { console.log('POSTS.load(sitehash, courseid, forumid, discussionid)', sitehash, courseid, forumid, discussionid); }
        var site = MOODLE.siteGet(sitehash);
        if (typeof site === 'undefined' || typeof site.courses === 'undefined' || typeof site.courses[courseid] === 'undefined' || typeof site.courses[courseid].forums[forumid] === 'undefined') {
            UI.alert(language.t('Unkown_error_occurred'));
            return;
        }
        var forum = site.courses[courseid].forums[forumid];
        var sitedynamic = MOODLE.siteGetDynamic(site.hash);
        var discussiondynamic = (typeof sitedynamic.discussions !== 'undefined' && typeof sitedynamic.discussions[discussionid] !== 'undefined') ? sitedynamic.discussions[discussionid] : {};
        var updatedsince = discussiondynamic.updatedsince || 0;

        CONNECTOR.schedule({
            data: {
                act: 'get_posts',
                courseid: courseid,
                forumid: forumid,
                discussionid: discussionid,
                updatedsince: updatedsince-1,
            },
            identifier: 'get_posts_' + site.wwwroot + '_' + site.userid + '_' + discussionid,
            site: site,
        }, true);
    },
    /**
     * Load the stream of posts from site.
     * @param sitehash
     * @param lastknownmodified (optional) timestamp of most current post that we know from this site.
     * @param offset (optional) offset to use for query
     * @param limit (optional) we want to use for query (amount of items we get per call)
     * @param ordering (optional) either 'ASC' or 'DESC' for query
     * @param priorto (optional) timestamp of oldest post we know - in that case we automatically use DESC!
     * @param payload (optional) control-information for POSTS.listStream
     */
    loadStream: function(sitehash, lastknownmodified, offset, limit, ordering, priorto, payload) {
        if (POSTS.debug > 0) { console.log('POSTS.loadStream(sitehash, lastknownmodified, offset, limit, ordering, priorto, payload)', sitehash, lastknownmodified, offset, limit, ordering, priorto, payload); }
        var site = MOODLE.siteGet(sitehash);
        if (typeof site === 'undefined') {
            if (POSTS.debug > 0) console.error(' => NOT SUCH SITE FOUND FOR HASH ', sitehash);
            //UI.alert(language.t('Unkown_error_occurred'));
            return;
        }
        if (typeof lastknownmodified === 'undefined') {
            var sitedynamic = MOODLE.siteGetDynamic(site.hash);
            lastknownmodified = sitedynamic.lastknownmodified || 0;
        }
        offset = offset || 0;
        ordering = ordering || 'ASC';
        limit = limit || 100;
        payload = payload || {};
        priorto = priorto || 0;

        CONNECTOR.schedule({
            data: {
                act: 'get_stream',
                lastknownmodified: lastknownmodified,
                limit: limit,
                offset: offset,
                ordering: ordering,
                priorto: priorto,
            },
            payload: payload,
            identifier: 'get_stream_' + site.wwwroot + '_' + site.userid + '_' + lastknownmodified + '_' + offset,
            site: site,
        }, true);
    },
    /**
     * Post a post to a discussion.
     */
    post: function() {
        $('#post-add').attr('disabled', 'disabled');
        var sitehash = +$('#posts').attr('data-sitehash');
        var discussionid = +$('#posts').attr('data-discussionid');
        var site = MOODLE.siteGet(sitehash);
        console.log(site);

        CONNECTOR.schedule({
            data: {
                act: 'create_post',
                discussionid: discussionid,
                message: $('#post-add').val(),
            },
            //payload: payload,
            identifier: 'create_post_' + site.wwwroot + '_' + site.userid + '_' + discussionid,
            site: site,
        }, true);
    },
    /**
     * Remove particular post.
     * @param site
     * @param postid
     */
    removePost: function(site, postid) {
        if (POSTS.debug > 0) console.log('POSTS.removePost(site, postid)', site, postid);
        app.db.transaction('posts', 'readonly').objectStore('posts').get([site.hash, postid]).onsuccess = function(event) {
            var post = event.result;
            app.db.transaction('posts', 'readwrite').objectStore('posts').delete([site.hash, postid]).onsuccess = function(){
                POSTS.listStream();
                if (post && post.id) {
                    POSTS.show(site.wwwroot, site.userid, post.courseid, post.forumid, post.discussionid, false);
                    DISCUSSIONS.show(site.wwwroot, site.userid, post.courseid, post.forumid, false);
                }
            };

        }

    },
    /**
     * Do everything to show all posts of a specific discussion.
     * @param wwwroot
     * @param userid
     * @param courseid
     * @param forumid
     * @param discussionid
     * @param navigate 1 if we should navigate to the page
     */
    show: function(wwwroot, userid, courseid, forumid, discussionid, navigate) {
        if (POSTS.debug > 0) console.log('POSTS.show(wwwroot, userid, courseid, forumid, discussionid, navigate)', wwwroot, userid, courseid, forumid, discussionid, navigate);
        if (!empty(userid) && userid > 0) {
            if (!POSTS.active(wwwroot, discussionid)) {
                $('#div-posts').empty();
            }
            var site = MOODLE.siteGet(wwwroot, userid);
            // if we were commanded to navigate there and we have a discussionid, make it active!
            if (!empty(navigate) && navigate && !empty(discussionid)) {
                POSTS.active(site.hash, discussionid, true);
            }
            POSTS.list(site.hash, courseid, forumid, discussionid, undefined, navigate);
            setTimeout(function(){ POSTS.load(site.hash, courseid, forumid, discussionid); },50);
        } else {
            var possiblesites = MOODLE.siteGet(wwwroot, -1);
            var userids = Object.keys(possiblesites);
            if (userids.length === 0) {
                console.debug('We have no user on that site? How is that going????');
            } else if (userids.length === 1) {
                console.debug('We have one user on that site and open this one automatically');
                POSTS.show(wwwroot, userids[0], courseid, forumid, discussionid, navigate);
            } else {
                console.debug('We have multiple sites - show dialogue', possiblesites);
                // Load discussion.
                var loadcnt = 0;
                var targetcnt = userids.length;
                var accessusers = [];
                userids.forEach(function(userid){
                    var site = possiblesites[userid];
                    if (typeof site.user === 'undefined') {
                        MOODLE.siteMyData(site);
                        loadcnt++;
                        return;
                    }
                    if (!site.isactive) {
                        loadcnt++;
                        return;
                    }
                    app.db.transaction('discussions', 'readonly').objectStore('discussions').index('sitehash_discussionid').get([site.hash, discussionid]).onsuccess = function(event) {
                        loadcnt++;
                        if (event.target.result) {
                            var discussion = event.target.result;
                            var site = MOODLE.siteGet(discussion.sitehash);
                            if (typeof site.courses !== 'undefined'
                                &&
                                typeof site.courses[courseid] !== 'undefined'
                                &&
                                typeof site.courses[courseid].forums[forumid] !== 'undefined'
                                &&
                                (
                                    site.courses[courseid].forums[forumid].groupmode == 0
                                    ||
                                    discussion.groupid == $('.group-selector').val()
                                    ||
                                    site.courses[courseid].forums[forumid].canaccessallgroups
                                )
                            ) {
                                accessusers[accessusers.length] = site.userid;
                            }
                        } else {
                            // We don't know this discussion. we have to load it.
                            console.error('Discussion unknown');
                        }
                        if (loadcnt == targetcnt) {
                            var options = [];
                            console.log('Accessuers', accessusers);
                            for (var a = 0; a < accessusers.length; a++) {
                                var userid = accessusers[a];
                                var xsite = MOODLE.siteGet(wwwroot, userid);
                                var username = (typeof xsite.user !== 'undefined' && typeof xsite.user.username !== 'undefined') ? xsite.user.username : language.t('Unknown');
                                options[options.length] = $('<option>').attr('value', userid).attr('wwwroot', wwwroot).html(username);
                            }
                            if (options.length == 0) {
                                console.log('Found no possible source - load discussion from all possible sites');
                                // We reload discussion from possible sites.
                                // It should be shown once it is loaded, as we already marked it as active!
                                //UI.alert(language.t('Unkown_error_occurred') + ' ' + language.t('Please_try_again'));
                                var userids = Object.keys(possiblesites);
                                userids.forEach(function(userid){
                                    var site = possiblesites[userid];
                                    DISCUSSIONS.load(site.hash, courseid, forumid, discussionid);
                                });
                            } else if (options.length == 1) {
                                POSTS.show($(options[0]).attr('wwwroot'), accessusers[0], courseid, forumid, discussionid, navigate);
                            } else {
                                var funcid = uuidv4('open_as_user_xxxxxxxxxxxxxxx');
                                var div = $('<div>').append([
                                    $('<p>').html(language.t('Open_as_user')),
                                    $('<select id="' + funcid + '">').append(options),
                                ])
                                UI.confirm(div, 'POSTS.show("' + wwwroot + '", $("#' + funcid + '").val(), ' + courseid + ', ' + forumid + ', ' + discussionid + ', ' + navigate + ');', '', true);
                            }
                        }
                    }
                });


            }
        }
    },
    /**
     * Stores a list of given POSTS.
     * @param site site the posts belong to.
     * @param posts list of posts
     * @param payload (optional) payload that was attached to ajax-call.
     */
    store: function(site, posts, payload) {
        if (POSTS.debug > 3) { console.log('POSTS.store(site, posts, payload)', site, posts, payload); }
        payload = payload || {};
        $('#div-posts .loading').remove();
        var sitedynamic = MOODLE.siteGetDynamic(site.hash);
        var store = app.db.transaction('posts', 'readwrite').objectStore('posts');
        var keys = Object.keys(posts);
        var lastpostid = posts[keys[keys.length - 1]].postid;
        for (var a = 0; a < keys.length; a++) {
            var post = posts[keys[a]];
            post.sitehash = site.hash;
            if (typeof post.postid === 'undefined') post.postid = post.id;

            var storedynamic = false;
            if (typeof sitedynamic.lastknownmodified === 'undefined') sitedynamic.lastknownmodified = 0;
            if (sitedynamic.lastknownmodified < post.modified) {
                sitedynamic.lastknownmodified = post.modified;
                storedynamic = true;
            }

            if (typeof sitedynamic.discussions === 'undefined') sitedynamic.discussions = {};
            if (typeof sitedynamic.discussions[post.discussionid] === 'undefined') sitedynamic.discussions[post.discussionid] = { updatedsince: 0 };
            if (sitedynamic.discussions[post.discussionid] < post.modified) {
                sitedynamic.discussions[post.discussionid].updatedsince = post.modified;
                storedynamic = true;
            }
            if (storedynamic) {
                MOODLE.siteGetDynamic(site.hash, null, sitedynamic);
            }

            if (POSTS.debug > 5) { console.log('=> Storing', post); }
            var islast = (lastpostid == post.postid);
            store.put(post).onsuccess = function(){
                if (islast) {
                    setTimeout(function(){
                        // Try this on the last post only - refreshes page if we are viewing one discussion.
                        POSTS.list(site.hash, post.courseid, post.forumid, post.discussionid);
                        // Furthermore refresh stream.
                        // If we were given a maximum it means we should use this.
                        POSTS.listStream(payload.maximum || 30);
                    },100);
                }
            };
        }
    },
}
