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
     * Posts a message to a conversation.
     */
    createMessage: function(){
        var sitehash = +$('#conversations').attr('data-sitehash');
        var conversationid = +$('#conversations').attr('data-conversationid');
        var site = MOODLE.siteGet(sitehash);
        var sites = DB.getConfig('sites');
        console.log(sites);
        if (typeof site === 'undefined' || typeof site.userid === 'undefined') {
            console.error('We do not have such a site with hash ', sitehash);
            return;
        }
        if (conversationid == 0) {
            console.error('No conversation id given');
            return;
        }
        var message = $('#conversation #message-add').val();
        CONNECTOR.schedule({
            data: {
                act: 'create_message',
                conversationid: conversationid,
                message: message,
                messageformat: 1, //html
                touserid: +$('#conversation').attr('data-firstuserid'), // Only required before Moodle 3.6
            },
            identifier: 'create_message_' + site.hash + '_' + conversationid + '_' + (new Date()).getTime(),
            site: site,
        }, true);
        $('#conversation #message-add').attr('disabled', 'disabled');
    },
    /**
     * Retrieve active conversations of a user.
     * @param site site object or wwwroot
     * @param userid only used when site is given as wwwroot
     */
    /* @todo since timestamp */
    getConversations: function(site, userid) {
        // Check if we get site from wwwroot
        if (typeof site === 'string' || typeof site === 'number') { site = MOODLE.siteGet(site, userid); }
        if (CONVERSATIONS.debug > 3) console.log('CONVERSATIONS.getConversations(site)', site);

        CONNECTOR.schedule({
            data: {
                act: 'get_conversations',
            },
            identifier: 'get_conversations_' + site.hash,
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

        var range = IDBKeyRange.bound([site.hash, conversationid, 0], [site.hash, conversationid, LIB.k9]);
        app.db.transaction('messages', 'readonly').objectStore('messages').index('sitehash_conversationid_modified').get(range, 'prev').onsuccess = function(event) {
            var lastmodified = 0;
            if (event.target.result) {
                // We have a message and take its timestamp.
                lastmodified = event.target.result.modified;
            }
            CONNECTOR.schedule({
                data: {
                    act: 'get_conversation_messages',
                    conversationid: conversationid,
                    lastmodified: lastmodified
                },
                identifier: 'get_conversation_messages_' + site.hash + '_' + conversationid,
                site: site,
            }, true);
        };
    },
    /**
     * List the contents of a particular conversation.
     */
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

        // This is for moodle 3.5 and earlier. We can not post to a conversation, we need to post to a user.
        // For these moodle-versions we can only have 1 recipient, therefore we choose the first one from the conversation.
        app.db.transaction('conversations', 'readonly').objectStore('conversations').get([sitehash, conversationid]).onsuccess = function(event) {
            var conversation = event.target.result;
            var membul = $('#conversation-members').empty();
            var members = {};
            if (typeof conversation !== 'undefined' && typeof conversation.members !== 'undefined') {
                Object.keys(conversation.members).forEach(function(id) {
                    var memberid = conversation.members[id].userid;
                    members[conversation.members[id].userfullname] = {
                        email: conversation.members[id].email,
                        userid: memberid,
                        userpictureurl: conversation.members[id].userpictureurl
                    };
                    if (memberid != site.userid) {
                        $('#conversation').attr('data-firstuserid', memberid);
                    }
                });
            } else {
                $('#conversation').attr('data-firstuserid', 0);
            }
            if (Object.keys(members).length == 0) {
                members[language.t('unknown')] = { userid: 0, userpictureurl: '' };
            }
            Object.keys(members).forEach(function(fullname) {
                membul.append(
                    $('<li>').append([
                        $('<a>').append([
                            $('<img>').attr('src', MOODLE.enhanceURL(site, members[fullname].userpictureurl)).attr('alt', fullname),
                            $('<h3>').html(fullname),
                            $('<p>').html(members[fullname].email),
                        ]).css('background-color', (members[fullname].userid == site.userid) ? '#ecf9fe' : '')
                    ]).attr('data-icon', 'false')
                );
            });
            try { membul.listview('refresh'); } catch(e) {}
        }

        LIB.coloringStart();
        app.db.transaction('messages', 'readonly').objectStore('messages').index(index).openCursor(range).onsuccess = function(event){
            var cursor = event.target.result;
            if (cursor) {
                var message = cursor.value;
                if (CONVERSATIONS.debug > 10) console.log(message);
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
                $(divP).find('.message').html(LIB.injectHTML(message.fullmessagehtml, site));
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
                var site = MOODLE.siteGet(message.sitehash);
                var wwwroothash = site.wwwroot.hashCode();

                if (typeof blocker[wwwroothash] === 'undefined') blocker[wwwroothash] = {};
                if (typeof blocker[wwwroothash][message.conversationid] !== 'undefined') { cursor.continue(); return; }
                counter++;
                if (counter > maximum) { cursor.continue(); return; }
                blocker[wwwroothash][message.conversationid] = true;

                var li = $(ul).children('.wwwroothash-' + wwwroothash + '.conversation-' + message.conversationid);
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
                    ]).addClass('sitewwwroot-' + wwwroothash)
                      .addClass('conversation-' + message.conversationid)
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
                //$(li).find('.userpicture').attr('src', userpictureurl).attr('alt', message.userfullname || language.t('Unknown'));
                $(li).find('.message').html(LIB.stripHTML(message.fullmessagehtml));
                //$(li).find('.author').html(message.userfullname);
                $(li).find('.datetime').html(UI.ts2time(message.timecreated, 'verbal'));
                //CONVERSATIONS.listStreamUser(li, site, message);
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
                                var priorto = $('#ul-stream .wwwroothash-' + wwwroothash).attr('data-modified') || Math.floor((new Date()).getTime() / 1000);
                                CONVERSATIONS.getConversations(site);
                            }
                        });
                    });
                }
            }
        };
    },
    /**
     * Load the user(s) of this conversation.
     */
    listStreamUser: function(li, site, message) {
        if (CONVERSATIONS.debug > 3) console.log('CONVERSATIONS.listStreamUser(li, site, message)', li, site, message);
        //var userpictureurl = !empty(message.userpictureurl) ? MOODLE.enhanceURL(site, message.userpictureurl) : '';
        //$(li).find('.userpicture').attr('src', userpictureurl).attr('alt', message.userfullname || language.t('Unknown'));
        //$(li).find('.author').html(message.userfullname);

        // New behavior: load all users from conversation
        if (CONVERSATIONS.debug > 5) console.log('NEW BEHAVIOR');
        app.db.transaction('conversations', 'readonly').objectStore('conversations').index('wwwroot_conversationid').get([site.wwwroot, message.conversationid]).onsuccess = function(event) {
            if (event.target) {
                var conversation = event.target.result;
                var allmembers = conversation.members;
                var excludesites = MOODLE.siteGet(site.wwwroot, -1);
                var othermembers = [];
                Object.keys(allmembers).forEach(function(id) {
                    var user = allmembers[id];
                    var found = false;
                    Object.keys(excludesites).forEach(function(sk) {
                        if (excludesites[sk].userid == user.userid) {
                            found = true;
                        }
                    });
                    if (!found) {
                        othermembers[othermembers.length] = user;
                    }
                });
                if (CONVERSATIONS.debug > 5) console.log(othermembers);
                // Now fill the contacts.
                if (othermembers.length == 1) {
                    // Show only the other
                    userpictureurl = !empty(othermembers[0].userpictureurl) ? MOODLE.enhanceURL(site, othermembers[0].userpictureurl) : '';
                    $(li).find('.userpicture').attr('src', userpictureurl).attr('alt', othermembers[0].userfullname || language.t('Unknown'));
                    $(li).find('.author').html(othermembers[0].userfullname);
                }
                if (othermembers.length == 2) {
                    // Split by half
                    var pictureurls = [
                        !empty(othermembers[0].userpictureurl) ? MOODLE.enhanceURL(site, othermembers[0].userpictureurl) : '',
                        !empty(othermembers[1].userpictureurl) ? MOODLE.enhanceURL(site, othermembers[1].userpictureurl) : '',
                    ];
                    $(li)
                        .find('.userpicture').attr('src', '').attr('alt', othermembers[0].userfullname + " & " + othermembers[1].userfullname)
                        .css('background', "url('" + pictureurls[0] + "') left no-repeat, url('" + pictureurls[1] + "') right no-repeat")
                        .css('background-size', "50%, 50%");

                    $(li).find('.author').html(othermembers[0].userfullname + " & " + othermembers[1].userfullname);
                }
                if (othermembers.length == 3) {
                    // First one half, others quarter
                    userpictureurl = !empty(othermembers[0].userpictureurl) ? MOODLE.enhanceURL(site, othermembers[0].userpictureurl) : '';
                    $(li).find('.userpicture').attr('src', userpictureurl).attr('alt', othermembers[0].userfullname || language.t('Unknown'));
                    $(li).find('.author').html(othermembers[0].userfullname);
                }
                if (othermembers.length > 3) {
                    // First 4 quarter
                    userpictureurl = !empty(othermembers[0].userpictureurl) ? MOODLE.enhanceURL(site, othermembers[0].userpictureurl) : '';
                    $(li).find('.userpicture').attr('src', userpictureurl).attr('alt', othermembers[0].userfullname || language.t('Unknown'));
                    $(li).find('.author').html(othermembers[0].userfullname);
                }
            }
        }
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
            }
            CONVERSATIONS.load(site, undefined, conversationid);
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
                        Object.keys(possiblesites).forEach(function(id){ CONVERSATIONS.getConversations(possiblesites[id]); });
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
        var wwwroot = sites.hashcodes[site.hash].wwwroot;
        var conversationid = +$('#conversations').attr('data-conversationid');
        var userid = +$('#conversations').attr('data-userid');
        console.log(sitehash, wwwroot, conversationid, userid);
        if (wwwroot != '' && conversationid > 0 && userid > 0) {
            // This short timeout is necessary to let the last database finish the last put.
            if (CONVERSATIONS.debug > 3) console.log('Reloading this conversations view in 100ms');
            setTimeout(function() { CONVERSATIONS.show(wwwroot, userid, conversationid, false); }, 100);
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
            message.modified = message.timecreated;
            message.sitehash = site.hash;
            store_messages.put(message).onsuccess = function(event) {
                CONVERSATIONS.storeCountModify(site, -1);
            }
        });
    },
}
