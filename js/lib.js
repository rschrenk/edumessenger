var LIB = {
    coloring_ids: {},
    coloring_last: undefined,
    k9: 9999999999, // Upper end for idb-bounds.
    /**
     * Capture either left or right swipes.
     */
    captureSwipe: function(e) {
        // Test if we are in a textbox
        var i = $(':focus');
        if (i.length > 0) {
            var f = i[0].tagName.toLowerCase();
            if (f == 'textarea' || f == 'input') return;
        }

        var curpage = $.mobile.pageContainer.pagecontainer('getActivePage').attr('id');

        e.preventDefault();

        // We check if there is no open panel on the page because otherwise
        // a swipe to close the left panel would also open the right panel (and v.v.).
        // We do this by checking the data that the framework stores on the page element (panel: open).
        if ($('.ui-page-active').jqmData('panel') !== 'open') {
            var panel, btn, action;
            if (e.type === 'swipeleft') {
                panel = $('#' + curpage + '-panel-right');
                btn = $('#' + curpage + ' div[data-role="header"]:first-child .ui-btn-right');
            } else if (e.type === 'swiperight') {
                panel = $('#' + curpage + '-panel-left');
                btn = $('#' + curpage + ' div[data-role="header"]:first-child .ui-btn-left');
            }

            if (btn.length > 0 && typeof btn.attr('data-rel') !== 'undefined' && btn.attr('data-rel') == 'back') {
                history.back();
                return;
            }

            if (btn.length > 0) action = $(btn).click();

            if (typeof action !== 'undefined') {
                eval(action);
            } else if (panel.length > 0) {
                panel.panel('open');
            } else if(e.type === 'swipeleft'){
                UI.navigate('#mainmenu');
            }
        }
    },
    coloringStart: function() {
        LIB.coloring_ids = {};
        LIB.coloring_last = undefined;
    },
    coloringColor: function(identity) {
        if (typeof LIB.coloring_ids[identity] !== 'undefined') {
            return LIB.coloring_ids[identity];
        } else {
            var table = [
                [69, 185, 255, 0.4],
                [129, 255, 212, 0.4],
                [74, 118, 232, 0.4],
                [74, 228, 232, 0.4],
                [94, 82, 255, 0.4],
                [30, 123, 178, 0.4],
                [34, 93, 127, 0.4],
                [17, 46, 64, 0.4],
            ];

            if (typeof LIB.coloring_last !== 'undefined') {
                LIB.coloring_last++;
                if (LIB.coloring_last > (table.length - 1)) {
                    LIB.coloring_last = 0;
                }
            } else {
                LIB.coloring_last = 0;
            }

            LIB.coloring_ids[identity] = table[LIB.coloring_last];
            return LIB.coloring_ids[identity];
        }
    },
    /**
     * Detect links, let external sites open in inapp browser and enhance attachments to be loaded with wstoken.
     */
    injectHTML: function(html, site) {
		if (UI.debug > 5) console.log('UI.injectHTML(html)', html);
		html = html.replace("&nbsp;", " ");
        // We convert markdown to html using showdown.
		if (typeof showdown !== 'undefined') {
			var converter = new showdown.Converter();
			converter.setOption('headerLevelStart', 3);
			// Ignore asterisks and underscores within words (often breaks urls)
			converter.setOption('literalMidWordAsterisks', true);
			converter.setOption('literalMidWordUnderscores', true);
			// enable task Lists
			converter.setOption('tasklists', true);
			// enable simple line breaks
			converter.setOption('simpleLineBreaks', true);
			html = converter.makeHtml(html);
			if (UI.debug > 5) console.log('UI.injectHTML(html) - after showdown', html);
		}

		var captures = [];

		//console.log('Before', el.clone());
        var el = $('<div>').html(html);
		el.find('*[href],*[src]').each(function(){
			var i = captures.length;
			if ($(this).attr('href')) {
				captures[i] = $(this).attr('href');
				$(this).attr('href', '').attr('data-edm-injection-href', i);
			}
			if ($(this).attr('src')) {
				captures[i] = $(this).attr('src');
				$(this).attr('src', '').attr('data-edm-injection-src', i);
			}
		});
		if (UI.debug > 5) console.log('UI.injectHTML(html) - after injections', html);
        html = ' ' + $(el).html() + ' ';
		html = html.replace(UI.LINK_DETECTION_REGEX, function(url) { return "<a href=\"" + url.trim() + "\" target=\"_blank\">" + url + "</a> "; });
		//html = html.replace(/(?:\r\n|\r|\n)/g, '<br />');
		if (UI.debug > 5) console.log('UI.injectHTML(html) - after regex', html);
		var el = $('<div>').html(html);
		el.find('*[data-edm-injection-href],*[data-edm-injection-src]').each(function(){
			var i = captures.length;
			if ($(this).attr('data-edm-injection-href')) {
				$(this).attr('href', captures[$(this).attr('data-edm-injection-href')]).attr('data-edm-injection-href', undefined);
			}
			if ($(this).attr('data-edm-injection-src')) {
				$(this).attr('src', captures[$(this).attr('data-edm-injection-src')]).attr('data-edm-injection-src', undefined);
			}
		});
        // Let all links open in systembrowser.
        el.find('*[href]:not(.edm6_injected),*[src]:not(.edm6_injected)').each(function(){
            // Ensure that links are opened in an external browser.
            if ($(this).attr('href')) {
                var onclick = (typeof $(this).attr('onclick') !== 'undefined') ? $(this).attr('onclick') + '; ' : '';
                $(this).attr('onclick', onclick + "window.open('" + MOODLE.enhanceURL(site, $(this).attr('href'), true) + "', '_system'); return false;");
            }
            // Append wstoken for images and such.
            if ($(this).attr('src')) {
                $(this).attr('src', MOODLE.enhanceURL(site, $(this).attr('src'), false));
            }
        });
		//console.log('After', el.clone());
		if (UI.debug > 5) console.log('UI.injectHTML(html) - at end', $(el).html().trim());
		return $(el).html().trim();
	},
    /**
     * Return the inner text of something.
     */
    stripHTML: function(html) {
        if (empty(html)) return html;
        return $('<div>').html(html).text();
        /*
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
        */
    },
}

/**
 * Intended to work equivalent to phps empty-function.
 */
function empty(val) {
    if (!val) return true;
    if (typeof val === 'undefined') return true;
    if (val == null) return true;
    if (val == '') return true;
    if (val == 0) return true;
    return false;
}

/**
 * Sort elements within an object by sub-fields as keys.
 * @param olist to sort
 * @param keys array of keys to use for sorting.
 * @param delimiter for sorting, if not specified use '_'
 * @return list with indizes specified by keys.
 */
function listObjBy(olist, keys, delimiter) {
    if (typeof delimiter === 'undefined') delimiter = '_';
    var nlist = {};
    Object.keys(olist).forEach(function(key) {
        var obj = olist[key];
        var sortkeys = [];
        keys.forEach(function(subkey) {
            sortkeys[sortkeys.length] = !empty(obj[subkey]) ? obj[subkey] : Math.random();
        });
        nlist[sortkeys.join(delimiter).toUpperCase()] = obj;
    });
    return nlist;
}

/**
 * Create an uuid-like random id.
 */
function uuidv4(format) {
    if (typeof format === 'undefined') {
        format = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    }
    return format.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// http://cwestblog.com/2011/10/11/javascript-snippet-string-prototype-hashcode/
String.prototype.hashCode = function() {
    for(var ret = 0, i = 0, len = this.length; i < len; i++) {
        ret = (31 * ret + this.charCodeAt(i)) << 0;
    }
    return ret;
};

// Handle double taps based on https://forum.jquery.com/topic/doubletap-event.
(function($) {
    $.fn.doubleTap = function(doubleTapCallback) {
        return this.each(function(){
            var elm = this;
            var lastTap = 0;
            $(elm).bind('vmousedown', function (e) {
                var now = (new Date()).valueOf();
                var diff = (now - lastTap);
                lastTap = now ;
                if (diff < 250) {
                    if($.isFunction( doubleTapCallback )) {
                        doubleTapCallback.call(elm);
                    }
                }
            });
        });
    }
})(jQuery);

// Prevent back movement to start page
window.addEventListener("hashchange", function(){
    console.log("going to", window.location.hash);
    if (typeof window.location.hash === 'undefined' || window.location.hash === '') {
        console.log('Gone back to site without hash - going forward again');
        history.go(0);
    }
});
// Fixing Anchors within Labels of checkboxes
$(document).on('pagecreate', function(event, ui) {
    $('.ui-checkbox a').each(function(i){
        if($(this).attr('onclick')===undefined)
        $(this).attr('onclick','ui.checkboxAnchor(event,this);');
    });
    $('.photopopup img').on('load', function(){
        UI.popupImageFix($(this));
    });
    //$('#popupImageSlide img').on('touchend', function(e){ var direction = (e.changedTouches[0].clientX < e.UI.popupImageMove($('#popupImageSlide '), 1); });
});
$(document).on('resume', function(){
    if (typeof window.FirebasePlugin !== 'undefined') {
        window.FirebasePlugin.setBadgeNumber(0);
    }
    CONNECTOR.stream();
});
