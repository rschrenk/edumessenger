var DISCUSSIONS = {
    debug: 6,
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

        if (forum.groupmode > 0) {
            var sel = $('.group-selector').empty();
            if (!empty(forum.canaccessallgroups) && forum.canaccessallgroups) {
                $(sel).append($('<option value="-1">').html(language.t('All_groups')));
            }
            Object.keys(forum.groups).forEach(function(groupid){
                var group = forum.groups[groupid];
                $(sel).append($('<option value="' + groupid + '">').html(group.name));
            });
        }
        $('.group-selector-wrapper').css('display', (forum.groupmode > 0) ? 'block' : 'none');
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

        var store = app.db.transaction('discussions', 'readwrite').objectStore('discussions');
        var keys = Object.keys(discussions);
        keys.forEach(function(discussionid) {
            var discussion = discussions[discussionid];
            discussion.sitehash = site.hash;
            if (typeof sitedynamic.forums === 'undefined') sitedynamic.forums = {};
            if (typeof sitedynamic.forums[discussion.forumid] === 'undefined') sitedynamic.forums[discussion.forumid] = {};
            var forumdynamic = sitedynamic.forums[discussion.forumid] || {};
            var updatedsince = forumdynamic.updatedsince || 0;
            if (updatedsince < discussion.timemodified) {
                sitedynamic.forums[discussion.forumid].updatedsince = discussion.timemodified;
                MOODLE.siteGetDynamic(site.hash, sitedynamic);
            }
            if (DISCUSSIONS.debug > 5) { console.log('=> Storing', discussion); }
            var islast = discussionid == keys[keys.length - 1];
            store.put(discussion).onsuccess = function(){
                if (islast) {
                    // Ensure to reload interface when we view a specific forum.
                    DISCUSSIONS.listDiscussions(site.hash, discussion.courseid, discussion.forumid);
                    if (!empty(opendiscussionid)) {
                        app.db.transaction('discussions', 'readwrite').objectStore('discussions').get([site.hash, opendiscussionid]).onsuccess = function(event) {
                            var discussion = event.target.result;
                            if (discussion) {
                                POSTS.show(site.wwwroot, 0, discussion.courseid, discussion.forumid, discussion.discussionid, true);
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
