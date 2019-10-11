var DISCUSSIONS = {
    debug: 1,
    /**
     * Sets or checks if a forum is currently shown.
     */
    active: function(sitehash, forumid, set) {
        if (!empty(set) && set) {
            $('#discussions').attr('data-sitehash', sitehash).attr('data-forumid', forumid);
            return true;
        }
        return $('#discussions').attr('data-sitehash') == sitehash && $('#discussions').attr('data-forumid') == forumid;
    },
    /**
     * Load the latest post from database and fill some html field with this data.
     * @param sitehash of site
     * @param userid user has on site
     * @param discussionid discussionid we want to load
     * @param li html element we want to enhance.
     * @param fieldmapping map specific fields of post-object to html-classes.
     */
    fillDiscussionData: function(sitehash, discussionid, li, fieldmapping) {
        if (DISCUSSIONS.debug > 3) { console.log('DISCUSSIONS.fillDiscussionData(sitehash, discussionid, li, fieldmapping)', sitehash, discussionid, li, fieldmapping); }
        app.db.transaction('discussions', 'readonly').objectStore('discussions').get([sitehash, discussionid]).onsuccess = function(event) {
            var discussion = event.target.result;
            if (discussion) {
                if (typeof fieldmapping !== 'undefined') {
                    Object.keys(fieldmapping).forEach(function(key) {
                        $(li).find('.' + fieldmapping[key]).html(LIB.stripHTML(discussion[key]) || language.t('Unknown'));
                    });
                } else {
                    Object.keys(discussion).forEach(function(key) {
                        $(li).find('.' + key).html(LIB.stripHTML(discussion[key]));
                    });
                }
            }
        }
    },
    /**
     * List discussions of a certain forum.
     */
    listDiscussions: function (sitehash, courseid, forumid, groupid) {
        if (DISCUSSIONS.debug > 0) { console.log('DISCUSSIONS.listDiscussions(sitehash, courseid, forumid, groupid)', sitehash, courseid, forumid, groupid); }
        var site = MOODLE.siteGet(sitehash);
        if (!DISCUSSIONS.active(sitehash, forumid)) {
            if (DISCUSSIONS.debug > 0) { console.log(' => ABORTED, not active'); }
            return;
        }

        var course = site.courses[courseid];
        var forum = course.forums[forumid];

        // ATTENTION, check if this forum is accessible with other connected sites. If it is so provide a popup via a button on the right upper corner.
        // This also applies to posts. (and messages?)

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

        var predecessor = undefined;
        var ul = $('#ul-discussions');
        ul.children('li:not(.loading)').addClass('flag-removable');
        var index = 'sitehash_forumid_modified';
        var range = IDBKeyRange.bound([site.hash, forumid, 0], [site.hash, forumid, LIB.k9]);
        groupid = groupid || -1;
        if (groupid > -1) {
            index = 'sitehash_forumid_groupid_modified';
            range = IDBKeyRange.bound([site.hash, forumid, groupid, 0], [site.hash, forumid, groupid, LIB.k9]);
        }
        //console.log(range);
        app.db.transaction('discussions', 'readonly').objectStore('discussions').index(index).openCursor(range, 'prev').onsuccess = function(event){
            var cursor = event.target.result;
            if (cursor) {
                var discussion = cursor.value;
                var userpictureurl = !empty(discussion.userpictureurl) ? MOODLE.enhanceURL(site, discussion.userpictureurl) : '';

                var li = $(ul).find('.site-' + site.hash + '.discussion-' + discussion.discussionid);
                if (li.length == 0) {
                    li = $('<li>').append([
                        $('<a>').append([
                            $('<img class="userpicture" alt="Userpicture">'),
                            $('<h3 class="author">'),
                            $('<p>').append([
                                 $('<span class="title">'),
                                 $('<span>').html(' &gt; '),
                                 $('<span class="message">'),
                            ]),
                            $('<span class="ui-li-count datetime">'),
                        ]).attr('href', '#').attr('onclick', 'POSTS.show("' + site.wwwroot + '", ' + site.userid + ', ' + courseid + ', ' + forumid + ', ' + discussion.discussionid + ', 1);'),
                    ]).addClass('site-' + site.hash).addClass('discussion-' + discussion.discussionid);
                    if (typeof predecessor === 'undefined') {
                        ul.append(li);
                    } else {
                        li.insertAfter(predecessor);
                    }
                }
                li.removeClass('flag-removable');
                $(li).find('.author').html(discussion.userfullname);
                $(li).find('.datetime').html(UI.ts2time(discussion.timemodified, 'verbal'));
                $(li).find('.message').html(LIB.stripHTML(discussion.message));
                $(li).find('.title').html(discussion.subject);
                $(li).find('.userpicture').attr('src', userpictureurl).attr('alt', discussion.userfullname || language.t('Unknown'));
                //POSTS.fillLastPostData(sitehash, courseid, forumid, groupid, discussion.discussionid, li, { userfullname: 'author', message: 'message'});

                predecessor = li;
                cursor.continue();
            } else {
                $(ul).children('.flag-removable').remove();
                if ($(ul).children('li').length === 0) {
                    $(ul).append($('<li>').html(language.t('No_discussion_so_far')));
                }
                try { $(ul).listview('refresh'); } catch (e) {}
            }
        };
    },
    load: function(sitehash, courseid, forumid, opendiscussionid) {
        if (DISCUSSIONS.debug > 0) { console.log('DISCUSSIONS.load(sitehash,courseid, forumid)', sitehash, courseid, forumid); }
        var site = MOODLE.siteGet(sitehash);
        if (typeof site === 'undefined' || typeof site.courses === 'undefined' || typeof site.courses[courseid] === 'undefined' || typeof site.courses[courseid].forums[forumid] === 'undefined') {
            UI.alert(language.t('Unkown_error_occurred'));
            return;
        }
        var forum = site.courses[courseid].forums[forumid];
        var updatedsince = forum.updatedsince || 0;

        $('#ul-discussions').prepend($('<li class="loading">').html(language.t('loading')));

        CONNECTOR.schedule({
            data: {
                act: 'get_discussions',
                courseid: courseid,
                forumid: forumid,
                updatedsince: updatedsince,
            },
            identifier: 'get_discussions_' + sitehash + '_' + site.userid + '_' + forumid,
            payload: {
                opendiscussionid: opendiscussionid,
            },
            site: site,
        }, true);
    },
    /**
     * Post a discussion to the moodle forum.
     */
    post: function() {
        $('#discussion-add').attr('disabled', 'disabled');
        $('#discussion-add-topic').attr('disabled', 'disabled');
        var sitehash = +$('#discussions').attr('data-sitehash');
        var forumid = +$('#discussions').attr('data-forumid');
        var groupid = +$('#discussion-add-group').val();
        if (!Math.round(groupid) > 0) groupid = -1;
        var site = MOODLE.siteGet(sitehash);
        console.log(site);
        // We send potential userids we have locally to get info about access.
        var possiblesites = MOODLE.siteGet(site.wwwroot, -1);

        CONNECTOR.schedule({
            data: {
                act: 'create_discussion',
                forumid: forumid,
                groupid: groupid,
                message: $('#discussion-add').val(),
                potentialusers: Object.keys(possiblesites),
                topic: $('#discussion-add-topic').val(),
            },
            //payload: payload,
            identifier: 'create_discussion_' + site.wwwroot + '_' + site.userid + '_' + forumid,
            site: site,
        }, true);
    },
    /**
     * Do everything to show all discussions of a specific forum.
     */
    show: function(sitehash, courseid, forumid, navigate) {
        if (!DISCUSSIONS.active(sitehash, forumid)) {
            $('#ul-discussions').empty();
        }
        DISCUSSIONS.active(sitehash, forumid, true);
        DISCUSSIONS.load(sitehash, courseid, forumid);
        DISCUSSIONS.listDiscussions(sitehash, courseid, forumid);
        if (!empty(navigate) && navigate == 1) {
            UI.navigate('#discussions');
        }
    },
    /**
     * Stores a list of given discussions.
     * @param site site-object
     * @param discussions list of Discussions
     * @param opendiscussionid (optional) discussionid to open via POSTS.show
     */
    store: function(site, discussions, opendiscussionid) {
        if (DISCUSSIONS.debug > 3) { console.log('DISCUSSIONS.store(site, discussions, opendiscussionid)', site, discussions, opendiscussionid); }
        $('#ul-discussions .loading').remove();
        var sitedynamic = MOODLE.siteGetDynamic(site.hash);
        var openasuserid = 0;

        var parseddiscussions = [];
        // First step: Parse through discussions and create a new array. If a discussion belongs to multiple users we multiply it for each user!
        var keys = Object.keys(discussions);
        keys.forEach(function(discussionid) {
            var odiscussion = discussions[discussionid];
            odiscussion.discussionid = odiscussion.discussion;
            // If we do it like that we store the original userid as "openasuserid"
            if (typeof odiscussion.accessusers !== 'undefined') {
                openasuserid = site.userid;
                odiscussion.accessusers.forEach(function(userid) {
                    var discussion = JSON.parse(JSON.stringify(odiscussion));
                    var xsite = MOODLE.siteGet(site.wwwroot, userid);
                    discussion.sitehash = xsite.hash;
                    delete(discussion.accessusers);
                    var xsitedynamic = MOODLE.siteGetDynamic(xsite.hash);
                    if (typeof xsitedynamic.forums === 'undefined') xsitedynamic.forums = {};
                    if (typeof xsitedynamic.forums[discussion.forumid] === 'undefined') xsitedynamic.forums[discussion.forumid] = {};
                    var xforumdynamic = xsitedynamic.forums[discussion.forumid] || {};
                    var updatedsince = xforumdynamic.updatedsince || 0;
                    if (updatedsince < discussion.timemodified) {
                        xsitedynamic.forums[discussion.forumid].updatedsince = discussion.timemodified;
                        MOODLE.siteGetDynamic(site.hash, xsitedynamic);
                    }
                    parseddiscussions[parseddiscussions.length] = discussion;
                });
            } else {
                odiscussion.sitehash = site.hash;
                if (typeof sitedynamic.forums === 'undefined') sitedynamic.forums = {};
                if (typeof sitedynamic.forums[odiscussion.forumid] === 'undefined') sitedynamic.forums[odiscussion.forumid] = {};
                var forumdynamic = sitedynamic.forums[odiscussion.forumid] || {};
                var updatedsince = forumdynamic.updatedsince || 0;
                if (updatedsince < odiscussion.timemodified) {
                    sitedynamic.forums[odiscussion.forumid].updatedsince = odiscussion.timemodified;
                    MOODLE.siteGetDynamic(site.hash, sitedynamic);
                }
                parseddiscussions[parseddiscussions.length] = odiscussion;
            }
        });
        console.debug('Parsed discussions', parseddiscussions);

        // Second step: Just put them into the database.

        var store = app.db.transaction('discussions', 'readwrite').objectStore('discussions');
        var keys = Object.keys(parseddiscussions);
        keys.forEach(function(parseddiscussionid) {
            var discussion = parseddiscussions[parseddiscussionid];
            if (DISCUSSIONS.debug > 5) { console.log('=> Storing', discussion); }
            var islast = parseddiscussionid == keys[keys.length - 1];
            store.put(discussion).onsuccess = function(){
                if (islast) {
                    // Ensure to reload interface when we view a specific forum.
                    DISCUSSIONS.listDiscussions(site.hash, discussion.courseid, discussion.forumid);
                    if (!empty(opendiscussionid)) {
                        app.db.transaction('discussions', 'readonly').objectStore('discussions').get([site.hash, opendiscussionid]).onsuccess = function(event) {
                            var discussion = event.target.result;
                            if (discussion) {
                                setTimeout(function(){
                                    POSTS.show(site.wwwroot, openasuserid, discussion.courseid, discussion.forumid, discussion.discussionid, true);
                                }, 100);
                            } else {
                                console.error('Wanted to open opendiscussionid', opendiscussionid, 'but it still can not be found');
                            }
                        }
                    }
                }
            };
        });

    },
}
