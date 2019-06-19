var CONVERSATIONS = {
    debug: 10,
    /**
     * Sets or checks if a conversation is currently shown.
     */
    active: function(sitehash, conversationid, set) {
        if (!empty(set) && set) {
            $('#conversations').attr('data-sitehash', sitehash).attr('data-conversationid', conversationid);
            return true;
        }
        return $('#conversations').attr('data-sitehash') == sitehash && $('#conversations').attr('data-conversationid') == conversationid;
    },
    /**
     * Retrieve active conversations of a user.
     * @param site site object or wwwroot
     * @param userid only used when site is given as wwwroot
     */
    getConversations: function(site, userid) {
        // Check if we get site from wwwroot
        if (typeof site === 'string') { site = MOODLE.siteGet(site, userid); }
        if (CONVERSATIONS.debug > 3) console.log('CONVERSATIONS.getConversations(site)', site);

        CONNECTOR.schedule({
            data: {
                act: 'get_conversations',
            },
            identifier: 'get_conversations_' + site.sitehash,
            site: site,
        }, true);
    },
    /**
     * Load messages for a particular conversation.
     * @param site
     * @param userid only used when site is given as wwwroot
     * @param conversationid
     */
    load: function(site, userid, conversationid) {
        // Check if we get site from wwwroot
        if (typeof site === 'string') { site = MOODLE.siteGet(site, userid); }
        if (CONVERSATIONS.debug > 3) console.log('CONVERSATIONS.load(site, userid, conversationid)', site, userid, conversationid);

        CONNECTOR.schedule({
            data: {
                act: 'get_conversation_messages',
                conversationid: conversationid,
            },
            identifier: 'get_conversation_messages_' + site.hash + '_' + conversationid,
            site: site,
        }, true);
    },
    list: function(sitehash, conversationid, navigate) {
        navigate = navigate || false;
        if (CONVERSATIONS.debug > 0) { console.log('CONVERSATIONS.list(sitehash, conversationid, navigate)', sitehash, conversationid, navigate); }
        if (!CONVERSATIONS.active(sitehash, conversationid)) {
            if (CONVERSATIONS.debug > 0) { console.log(' => ABORTED, not active'); }
            return;
        }
        var site = MOODLE.siteGet(sitehash);

        // ATTENTION, we can be member of this conversation with multiple accounts!

        var predecessor = undefined;
        var div = $('#div-conversation');
        div.children('div:not(.loading)').addClass('flag-removable');
        var index = 'sitehash_conversationid_modified';
        var range = IDBKeyRange.bound([sitehash, conversationid, 0], [sitehash, conversationid, LIB.k9]);

        LIB.coloringStart();
        app.db.transaction('messages', 'readonly').objectStore('messages').index(index).openCursor(range).onsuccess = function(event){
            var cursor = event.target.result;
            if (cursor) {
                var message = cursor.value;
                console.log(message);
                var userpictureurl = !empty(message.userpictureurl) ? MOODLE.enhanceURL(site, message.userpictureurl) : '';

                var divP = $(div).find('.site-' + site.hash + '.message-' + message.messageid);
                if (divP.length == 0) {
                    divP = $('<div>').append([
                        $('<div>').append([
                            $('<a>').append([
                                $('<img class="userpicture">').attr('src', userpictureurl),
                            ]).attr('href', '#').attr('onclick', 'CONVERSATION.startConversation(' + sitehash + ', ' + message.userid + ',true); $("#messages .ui-header h1").html($(this).attr("data-name"));').attr('data-name', message.userfullname),
                            $('<p class="author">'),
                            $('<p class="datetime">'),
                            $('<p class="message">'),
                            $('<div class="attachments">'),
                            $('<a class="score">'),
                        ]).attr('style','border: 2px solid rgba(' + LIB.coloringColor(message.userid).join(',') + ');')
                          .addClass((site.userid == message.userid) ? 'post-self' : 'post-other'),
                    ]).addClass('site-' + site.hash)
                      .addClass('message-' + message.messageid)
                      .addClass('message ui-scroll-element')
                      .css({ overflow: 'hidden', position: 'relative' });
                    if (typeof predecessor === 'undefined') {
                        div.append(divP);
                    } else {
                        divP.insertAfter(predecessor);
                    }
                }
                divP.removeClass('flag-removable');
                $(divP).find('.author').html(message.userfullname || language.t('Unknown'));
                $(divP).find('.datetime').html(UI.ts2time(message.timecreated, true));
                $(divP).find('.message').html(LIB.injectHTML(message.fullmessagehtml));
                //$(divP).find('.attachments').html(post.message);

                predecessor = divP;
                cursor.continue();
            } else {
                $(div).children('.flag-removable').remove();
                if (navigate) {
                    UI.navigate('#conversation');
                }
            }
        };
    },
    /**
     * Show the latest messages through all sites. Only show one message per conversation.
     * @param maximum of items to show (grows when bouncing)
     * @param navigate whether or not to navigate to stream after listing
     * @param callbybounce wheter or not function was called by user bouncing end of list.
     */
    listStream: function(maximum, navigate, callbybounce) {
        maximum = maximum || 30;
        navigate = navigate || false;
        callbybounce = callbybounce || false;
        if (CONVERSATIONS.debug > 0) { console.log('CONVERSATIONS.listStream(maximum)', maximum); }

        var ul = $('#ul-conversations');
        $(ul).children().addClass('flag-removable');

        var blocker = {};
        var counter = 0;
        var predecessor = undefined;

        app.db.transaction('messages', 'readonly').objectStore('messages').index('modified').openCursor(undefined, 'prev').onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                var message = cursor.value;

                if (typeof blocker[message.sitehash] === 'undefined') blocker[message.sitehash] = {};
                if (typeof blocker[message.sitehash][message.conversationid] !== 'undefined') { cursor.continue(); return; }
                counter++;
                if (counter > maximum) { cursor.continue(); return; }
                blocker[message.sitehash][message.conversationid] = true;

                var site = MOODLE.siteGet(message.sitehash);
                var userpictureurl = !empty(message.userpictureurl) ? MOODLE.enhanceURL(site, message.userpictureurl) : '';

                var li = $(ul).children('.sitehash-' + message.sitehash + '.conversation-' + message.conversationid);
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
                        ]).attr('href', '#').attr('onclick', 'CONVERSATIONS.show("' + site.wwwroot + '", undefined, ' + message.conversationid + ', 1);'),
                    ]).addClass('sitehash-' + message.sitehash)
                      .addClass('conversation-' + message.conversatinonid)
                      .attr('data-modified', message.modified);
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
                $(li).find('.userpicture').attr('src', userpictureurl).attr('alt', message.userfullname || language.t('Unknown'));
                $(li).find('.message').html(LIB.stripHTML(message.fullmessagehtml));
                $(li).find('.author').html(message.userfullname);
                $(li).find('.datetime').html(UI.ts2time(message.timecreated, 'verbal'));

                cursor.continue();
            } else {
                if (navigate) {
                    UI.navigate((counter > 0) ? '#conversations' : '#courses');
                }
                $(ul).children('.flag-removable').remove();
                try { $(ul).listview('refresh'); } catch(e) {}
                $(document).off('scroll').scroll(function() {
                    if ($(window).scrollTop() >= $(document).height() - $(window).height() - 100) {
                        CONVERSATIONS.listStream(maximum + 30);
                    }
                });
                if (callbybounce && counter < maximum) {
                    var sites = DB.getConfig('sites');
                    sites.forEach(function(wwwroot) {
                        sites[wwwroot].forEach(function(site) {
                            if (!empty(site.hash)) {
                                var priorto = $('#ul-stream .sitehash-' + site.hash).attr('data-modified') || Math.floor((new Date()).getTime() / 1000);
                                CONVERSATIONS.getConversations(site);
                            }
                        });
                    });
                }
            }
        };
    },
    /**
     * Show a conversation. Checks if multiple accounts could access it.
     * @param wwwroot
     * @param userid
     * @param conversationid
     * @param navigate
     */
    show: function(wwwroot, userid, conversationid, navigate) {
        if (CONVERSATIONS.debug > 0) console.log('CONVERSATIONS.show(wwwroot, userid, conversationid, navigate)', wwwroot, userid, conversationid, navigate);
        if (!empty(userid) && userid > 0) {
            var site = MOODLE.siteGet(wwwroot, userid);
            if (!CONVERSATIONS.active(site.hash, conversationid)) {
                $('#div-conversations').empty();
            }
            $('#conversations').attr('data-userid', userid);

            // if we were commanded to navigate there and we have a conversationid, make it active!
            if (!empty(navigate) && navigate && !empty(conversationid)) {
                CONVERSATIONS.active(site.hash, conversationid, true);
                CONVERSATIONS.load(site, undefined, conversationid);
            }
            CONVERSATIONS.list(site.hash, conversationid, navigate);
        } else {
            var possiblesites = MOODLE.siteGet(wwwroot, -1);
            var userids = Object.keys(possiblesites);
            if (userids.length === 0) {
                console.error('We have no user on that site? How is that going????');
            } else if (userids.length === 1) {
                CONVERSATIONS.show(wwwroot, userids[0], conversationid, navigate);
            } else {
                var accessusers = [];

                app.db.transaction('conversations', 'readonly').objectStore('conversations').index('wwwroot_conversationid').get([wwwroot, conversationid]).onsuccess = function(event) {
                    if (event.target.result) {
                        var conversation = event.target.result;
                        Object.keys(conversation.members).forEach(function(id){
                            var userid = conversation.members[id].userid;
                            Object.keys(possiblesites).forEach(function(id) {
                                var siteuserid = possiblesites[id].userid;
                                if (userid == siteuserid) {
                                    accessusers[accessusers.length] = siteuserid;
                                }
                            });
                        });
                    }
                    var options = [];
                    for (var a = 0; a < accessusers.length; a++) {
                        var userid = accessusers[a];
                        var xsite = MOODLE.siteGet(wwwroot, userid);
                        var username = (typeof xsite.user !== 'undefined' && typeof xsite.user.username !== 'undefined') ? xsite.user.username : language.t('Unknown');
                        options[options.length] = $('<option>').attr('value', userid).attr('wwwroot', wwwroot).html(username);
                    }
                    if (options.length == 0) {
                        console.log('Found no possible source - how is that going???');
                    } else if (options.length == 1) {
                        CONVERSATIONS.show($(options[0]).attr('wwwroot'), accessusers[0], conversationid, navigate);
                    } else {
                        var funcid = uuidv4('open_as_user_xxxxxxxxxxxxxxx');
                        var div = $('<div>').append([
                            $('<p>').html(language.t('Open_as_user')),
                            $('<select id="' + funcid + '">').append(options),
                        ])
                        UI.confirm(div, 'CONVERSATIONS.show("' + wwwroot + '", $("#' + funcid + '").val(), ' + conversationid + ', ' + navigate + ');', '', true);
                    }
                };
            }
        }
    },
    /**
     * Stores conversations for a site.
     * @param site
     * @param conversations
     */
    store: function(site, conversations) {
        if (CONVERSATIONS.debug > 3) { console.log('CONVERSATIONS.store(site, conversations)', site, conversations); }
        var sitedynamic = MOODLE.siteGetDynamic(site.hash);
        var store_conversations = app.db.transaction('conversations', 'readwrite').objectStore('conversations');
        var store_messages = app.db.transaction('messages', 'readwrite').objectStore('messages');

        CONVERSATIONS.storeCountModify(site, Object.keys(conversations).length);

        Object.keys(conversations).forEach(function(convid){
            var conversation = {
                conversationid: conversations[convid].conversationid,
                members: conversations[convid].members,
                sitehash: site.hash,
                wwwroot: site.wwwroot,
            };
            store_conversations.put(conversation).onsuccess = function(event) { CONVERSATIONS.storeCountModify(site, -1); };
            CONVERSATIONS.storeMessages(site, conversations[convid].messages);
        });
    },
    /**
     * Modify the storeCounter for a site. If we reach zero reload messages.
     * @param site
     */
    storeCountModify: function(site, by) {
        if (typeof CONVERSATIONS.storeCount === 'undefined') CONVERSATIONS.storeCount = {};
        if (typeof CONVERSATIONS.storeCount[site.hash] === 'undefined') CONVERSATIONS.storeCount[site.hash] = 0;
        CONVERSATIONS.storeCount[site.hash] = CONVERSATIONS.storeCount[site.hash] + by;
        if (CONVERSATIONS.debug > 3) console.log('storeCount for ' + site.hash + ' is now ' + CONVERSATIONS.storeCount[site.hash]);
        if (CONVERSATIONS.storeCount[site.hash] == 0) {
            CONVERSATIONS.listStream(30, false);
        }
        // Determine if this conversation is currently viewed.
        var sites = DB.getConfig('sites');
        var sitehash = $('#conversations').attr('data-sitehash');
        var wwwroot = sites.hashcodes[sitehash].wwwroot;
        var conversationid = $('#conversations').attr('data-conversationid');
        var userid = $('#conversations').attr('data-userid');
        if (wwwroot != '' && conversationid > 0 && userid > 0) {
            // This short timeout is necessary to let the last database finish the last put.
            setTimeout(100, function() { CONVERSATIONS.show(wwwroot, userid, conversationid, false); });
        }
    },
    /**
     * Stores messages (normally for a particular conversation).
     * @param site
     * @param messages
     */
    storeMessages: function(site, messages) {
        if (CONVERSATIONS.debug > 3) { console.log('CONVERSATIONS.storeMessages(site, messages)', site, messages); }
        var store_messages = app.db.transaction('messages', 'readwrite').objectStore('messages');
        CONVERSATIONS.storeCountModify(site, Object.keys(messages).length);

        Object.keys(messages).forEach(function(messageid) {
            var message = messages[messageid];
            message.messageid = messageid;
            message.modified = message.timecreated;
            message.sitehash = site.hash;
            store_messages.put(message).onsuccess = function(event) {
                CONVERSATIONS.storeCountModify(site, -1);
            }
        });
    },
}
