var UI = {
    debug: 1,
    funcs: {}, // Holder for dynamically created functions of UI.confirm
    LINK_DETECTION_REGEX: /(([a-z0-9]){3,7}:\/\/(\w{1,}.)?[\u00C0-\u017F\w-]{0,}.[\u00C0-\u017F\w\_]{0,15}\/?([\u00C0-\u017Fa-z0-9_?=\/-]){0,}[_.\-\?\#\=\&\u00C0-\u017F.a-zA-Z0-9\/]{0,}[^\<\"\\\n)])/gi,

    alert: function(tx) {
        UI.confirm(tx, undefined, undefined, true);
    },
    confirm: function(tx, callafterok, callafterclose, hidecancelbutton){
        hidecancelbutton = hidecancelbutton || false;
        // create an identifier to create functions on the fly.
        var funcid = uuidv4('xxxxxxxxxxxxxxx');

        UI.funcs[funcid] = {
            callafterclose: callafterclose || '',
            callafterok: callafterok || '',
        };

        if(UI.debug > 0) console.log('UI.confirm(tx, callafterok, callafterclose)', tx, UI.funcs[funcid].callafterok, UI.funcs[funcid].callafterclose);

        if($('.ui-popup-active').length>0) {
            if(UI.debug>0) console.log('=> Another Div is open, closing the former one');
            try {
                $('.ui-popup-active').bind({
                    popupafterclose: function() {
                        $(this).unbind("popupafterclose");
                        setTimeout(function() {
                            console.log('Trying to show confirmation');
                            UI.confirm(tx, callafterok, callafterclose, hidecancelbutton);
                        },100);
                    }
                });
                $('.ui-popup-active').popup('close');
            } catch(e){}
        } else {
            console.debug(UI[funcid + '_callafterok']);
            console.debug(UI[funcid + '_callafterclose']);
            var ap = $.mobile.pageContainer.pagecontainer( "getActivePage" );
            var popup = $('<div data-role="popup" class="ui-content messagePopup">').append([
                $('<p>').html(tx),
                $('<a href="#" onclick="$(\'.messagePopup\').popup(\'close\'); UI.dynamicFunction(\'callafterok\', \'' + funcid + '\');" data-role="button" data-icon="check" data-theme="b" data-translate="OK">').html(language.t('OK')),
                (!hidecancelbutton) ? $('<a href="#" data-rel="back" data-role="button" data-icon="delete" data-translate="Abort">').html(language.t('Abort')) : '',
            ]).on( "popupafterclose", function( event, ui ) { UI.dynamicFunction('callafterclose', funcid); });

            ap.append(popup).trigger("create");
            try { popup.popup('open'); } catch(e) { }
        }
    },
    /**
     * Get the id of the current page.
     * @return id of page.
     */
    currentPageId: function() {
        return $.mobile.pageContainer.pagecontainer('getActivePage').attr('id');
    },
    dynamicFunction: function(caller, funcid) {
        if (typeof UI.funcs[funcid] !== 'undefined' && typeof UI.funcs[funcid][caller] !== 'undefined') {
            if (UI.debug > 0) console.log('UI.dynamicFunction(caller, funcid)', caller, funcid, UI.funcs[funcid][caller]);
            eval(UI.funcs[funcid][caller]);
        } else {
            if (UI.debug > 0) console.log('UI.dynamicFunction(caller, funcid)', caller, funcid, 'NOT FOUND');
        }
    },
    /**
     * Initialize the UI.
     */
    init: function() {
        if (typeof cordova !== 'undefined' && typeof cordova.InAppBrowser !== 'undefined') {
            if (UI.debug > 0) console.log('Replacing window.open with cordova.inAppBrowser.open');
            window.open = cordova.InAppBrowser.open;
        } else {
            if (UI.debug > 0) console.error('No cordova.InAppBrowser available');
        }
        if (navigator.userAgent.toLowerCase().indexOf("android") > -1) {
            // This fixes the overlay of the keyboard on android devices.
            $('input, textarea').focus(function() { console.log('FOCUS'); try { StatusBar.show(); } catch(e) {} });
            $('input, textarea').blur(function() { console.log('BLUR'); try { StatusBar.hide(); } catch(e) {} });
        }
        $(document).find('div[data-role="page"]:not(.swipeenabled)').each(function(){
			$(this).addClass('swipeenabled');
			$(this).bind('swipeleft swiperight', function( e ) {
				LIB.captureSwipe(e);
			});
		});
        $(document).find('div[data-role="page"] div[role="main"]').each(function(){
			$(this).prepend('<div class="loading-spinner" style="height: 40px;"><center><img src="img/ajax-spinner.gif" alt="loading ..." style="height: 100%;"></center></div>');
		});
    },
    /**
     * Navigate internally between pages. Should always be used as extra functionality can be included.
     * @param target id of target page.
     * @param sender (optional) object that called the navigation.
     * @param tobottom Whether or not target page should be scrolled to bottom once load is complete.
     */
    navigate: function(target, sender, tobottom){
        if(UI.debug > 0) console.log('UI.navigate(target,sender,tobottom)', target, sender, tobottom);
        // try { pluginhost.StatusBar('hide'); } catch(e) {}
        tobottom = tobottom || false;

        var curpage = UI.currentPageId();
        var param = { transition: 'slidefade' };
        var senderid = '';
        if(typeof sender !== 'undefined') {
            if (typeof sender === 'string') senderid = sender;
            else if (typeof sender.id !== undefined) senderid = sender.id;
        }
        if (!empty(senderid) && senderid == 'mainmenu') {
            param.transition = 'fade'; // or none
        }

        if (target == '#availability') { AVAILABILITY.availabilityBuilder(); }
        if (target == '#connectMoodle') { MOODLE.siteTest(); }
        if (target == '#conversation') { tobottom = true; }
        if (target == '#posts') { tobottom = true; }
        if (target == '#stream' && (curpage == 'welcome' || curpage == 'initialization')) { param.transition = 'flip'; param.changeHash = false; }

        if(target=='#mainmenu'){
            var m = $('#mainmenu');
            try { m.panel().enhanceWithin(); } catch(e){}
            m.css({ display: 'block', opacity: '1' }).panel('open');
        } else {
            if (curpage == 'initialization') {
                window.location.replace(target);
            } else {
                $(':mobile-pagecontainer').pagecontainer('change', target, param);
            }
            if (tobottom) {
                $(target).ready(function(){ setTimeout(function(){UI.toBottom();},100); });
            }
        }
        $(target).find('iframe').each(function(i){
            if ($(this).hasClass('resize')) {
                UI.resizeIframe(this);
            }
        });
        $(target).trigger('resize');

        // Return false to prevent default href-behaviour.
        return false;
    },

    /**
     * Resizes an iframe. Needs to be within a page.
     * @param iframe the iframe to resize.
     */
    resizeIframe: function(iframe) {
        $(iframe).css('width', '100%')
                 .css('height',
                    Math.round($(window).height() - $(iframe).offset().top - 20) + 'px'
                 );
    },
    /**
     * Scroll to the bottom of the page.
     */
    toBottom: function() {
        if (UI.debug > 9) console.log('UI.toBottom()');
		if (!UI.activeScrolling) {
			setTimeout( function() {
				var goto = 0;
				var tests = [
					'.ui-page-active div[role="main"] .ui-not-read:first-child',
					'.ui-page-active div[role="main"] .ui-scroll-element:last-child',
					'.ui-page-active div[role="main"] *:last-child'
				];
				for (var a = 0; a < tests.length && goto == 0; a++) {
					var needle = $(tests[a]);
					if (needle.length > 0) {
						var o = needle.offset()
						goto = o.top;
						if (UI.debug > 9) console.log('Found scrollposition at ' + goto + 'px for selector ' + tests[a]);
					}
				}
				if (goto == 0) {
					goto = $('.ui-page-active div[role="main"]')[0].scrollHeight;
				}
				var firstScrollElement = $('.ui-page-active .ui-scroll-element');
				var header = $('.ui-page-active div[data-role="header"]');
				var firstHeight = 0;
				if (firstScrollElement.length > 0) {
					var offset = firstScrollElement.offset();
					firstHeight = offset.top;
					if (UI.debug > 9) console.log('Found firstScrollElement-Height at ' + firstHeight + 'px');
				} else if (header.length > 0) {
					firstHeight = header.outerHeight();
					if (UI.debug > 9) console.log('Found header-Height at ' + firstHeight + 'px');
				}
				goto = goto - firstHeight;

				if (UI.debug > 9) console.log('Going to scrollposition ' + goto + 'px');
	            $(window).scrollTop(goto);
	        }, 500);
		}
    },
    /**
     * Toggles a class on target and sets the icon of the sender based on the targets status.
     * @param String target CSS Selector of target
     * @param String classname class that should be toggled
     * @param DOMElement src Element that should change the icon
     * @param Array icons Array containing 2 icons. Index 0 icon if object hasclass, index 1 if object does not hasclass
     */
    toggleClass: function(target, classname, src, icons) {
        $(target).toggleClass(classname);
        if (typeof src === 'undefined' || typeof icons === 'undefined' || icons.length !== 2) return;
        var icon = 1, anicon = 0;
        if ($(target).hasClass(classname)) {
            icon = 0; anicon = 1;
        }
        $(src).removeClass('ui-icon-' + icons[anicon]).addClass('ui-icon-' + icons[icon]);
    },
    /**
     * Creates a human readable time from a unixtimestamp.
     * @param unixtimestamp
     * @param enhance: does some modifications (strip date if it is today, ...)
     * @return time in the format YYYY-MM-DD hh:ii:ss
     */
    ts2time: function(unixts, enhance){
        enhance = enhance || false;
        var cd = new Date();
        var d = new Date(unixts*1000);
        var YEAR = d.getFullYear();
        var MONTH = "0"+(d.getMonth()+1);
        var DAY = "0"+d.getDate();
        var HOURS = "0"+d.getHours();
        var MINUTES = "0"+d.getMinutes();
        var SECONDS = "0"+d.getSeconds();

        if (!empty(enhance) && enhance == 'verbal') {
            var diff_s = Math.round((cd - d) / 1000);
            if (diff_s < 120) {
                return language.t('ago_just_now');
            } else {
                var diff_i = Math.round(diff_s / 60);
                if (diff_i < 60) {
                    return language.t('ago_minutes').replace('{minutes}', diff_i);
                } else {
                    var diff_h = Math.round(diff_i / 60);
                    if (diff_h < 24) {
                        return language.t('ago_hours').replace('{hours}', diff_h);
                    } else {
                        var diff_d = Math.round(diff_h / 24);
                        if (diff_d < 7) {
                            return language.t('ago_days').replace('{days}', diff_d);
                        } else {
                            var diff_m = Math.round(diff_d / 30);
                            if (diff_m < 2) {
                                return language.t('ago_months_last');
                            } else {
                                return language.t('ago_months').replace('{months}', diff_m);
                            }
                        }
                    }
                }
            }
        } else if(!empty(enhance) && enhance) {
            if (d.getFullYear() == cd.getFullYear() && d.getMonth() == cd.getMonth() && d.getDate() == cd.getDate()) {
                if (d.getHours() == cd.getHours()) {
                    var minutes = Math.round((cd - d) / 1000 / 60);
                    if (minutes < 1) {
                        return language.t('ago_minutes').replace('{minutes}', minutes);
                    }
                }
                return HOURS.substr(-2)+':'+MINUTES.substr(-2)+':'+SECONDS.substr(-2);
            }
        }
        return YEAR+'-'+MONTH.substr(-2)+'-'+DAY.substr(-2)+' '+HOURS.substr(-2)+':'+MINUTES.substr(-2)+':'+SECONDS.substr(-2);
    },
}
