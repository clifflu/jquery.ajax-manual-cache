/**
 * jQuery.ajax-manual-cache.js
 * version 0.0.0
 *
 * Another cache layer for GET ajax requests.
 *
 * Copyright Cliff Chao-kuan Lu <clifflu@gmail.com>
 * Released under the MIT license
 */

(function($, undefined){

    var _fp_ajax = $.ajax;  // remembers the original $.ajax

    // main method
    $.ajax_mc = function(url, options){
        var s, 
            deferred,
            cached_result,
            context = {},
            update_cache = false;

        // same as jQuery.ajax
        if ( typeof url === "object" ) {
            options = url;
            url = undefined;
        } 

        // prepare options and s object as is done in jQuery.ajax
        options = $.extend({}, $.ajax_mc.defaults, options);
        s = jQuery.ajaxSetup( {}, options );

        // Russian roulette for cache maintenance
        if (Math.random() < options.amc_maint_prob) {
            _cache_maint();
        }

        // Cache GET requests only
        if ( (s.method || s.type).toLowerCase() === 'get') {
            // convert data object to string
            if ( s.data && s.processData && typeof s.data !== "string" ) {
                s.data = jQuery.param( s.data, s.traditional );
            }

            url = url || s.url;
            options.amc_key = options.amc_key || (url + (url.indexOf('?') !== -1 ? '&':'?') + s.data);
            cached_result = _cache_get(options.amc_group, options.amc_key);
            
            if (cached_result) {
                // cache hit, fire 'done' callback(s) in options
                if (options.success) {
                    if (typeof options.success == "function") {
                        options.success = [options.success];
                    }

                    $.each(options.success, function(idx, cb){
                        cb.call(s.context, cached_result);
                    })
                }
                deferred = $.Deferred();

                window.setTimeout(function(){
                    deferred.resolveWith(context, [cached_result]);
                }, 1);

                // job done, another ajax request saved.
                return deferred.promise();
            }
            update_cache = true;
        }

        // let jQuery.ajax finish the job
        deferred = _fp_ajax(url, options);
        
        if (update_cache) {
            deferred.done(function(data){
                _cache_set(options.amc_group, options.amc_key, data, options.amc_expires);
            })
        }

        return deferred;
    }

    // ==================
    // default options
    // ==================
    $.ajax_mc.defaults = {
        // 
        'amc_expires': 10000,       // default: 10000, 10 seconds
        //
        'amc_group': 'default',     // default: 'default'
        // probability to maintain cache by calling _maint_cache
        'amc_maint_prob': 0.05      // default: 0.05
    };

    // ==================
    // Other Exports
    // ==================

    // Override $.ajax, so the plugin applies to $.get()
    $.ajax_mc.override = function() {
        if ($.ajax !== $.ajax_mc) {
            $.ajax = $.ajax_mc;
        }
    };

    // Expose the original ajax method
    $.ajax_mc.original = _fp_ajax;

    // ==================
    // Utilities
    // ==================

    // calculates Object.length
    function _object_length(obj) {
        var cnt = 0, key;
        for(key in obj) {
            if (obj.hasOwnProperty) cnt++;
        }

        return cnt;
    }

    // ==================
    // Cache
    // ==================
    var _cached = {};       // cached results

    // undefined if cache miss and expire
    function _cache_get(group, key) {
        var now = Date.now();

        if (!(_cached[group] && _cached[group][key])) {
            return undefined;
        }
        
        if (now <= _cached[group][key]['expires']) {
            return _cached[group][key]['payload'];
        }

        delete(_cached[group][key]);
        return undefined;
            
    }

    // expires: milliseconds from now that this entry expires
    function _cache_set(group, key, payload, expires) {
        _cached[group] = _cached[group] || {};

        _cached[group][key] = {
            'expires': Date.now() + parseInt(expires, 10),
            'payload': payload
        };
    }

    function _cache_maint() {
        var now = Date.now(),
            group, 
            idx, 
            entry;

        for(group in _cached){
            if (!_cached.hasOwnProperty(group)) {
                continue;
            }

            $.each(_cached[group], function(idx, entry){
                if (now > entry.expires) {
                    delete(_cached[group][idx]);
                }
            });
        }

        $.each(_cached, function(idx, entry){
            if (0 === _object_length(entry)) {
                delete(_cached[idx]);
            }
        });
    }
})(jQuery);