var diaryApp = angular.module("diaryApp", [ "ngSanitize" ]);

diaryApp.factory('idGen', function() {
    function getStr(n) {
        return (0x10000 + n).toString(16).substr(-4);
    }
    function getPart() {
        return getStr(Math.floor(0x10000*Math.random()));
    }
    var PREFIX = [getPart(), getPart(), getPart(), getPart()].join(''),
        TICK = Math.floor(0x10000*Math.random());
    return {
        get: function() {
            return [PREFIX, getStr(++TICK), getPart()].join('');
        }
    };
});

diaryApp.controller("DiaryCtrl", ['$scope', '$window', '$http', '$timeout', 'idGen',
function($scope, $window, $http, $timeout, idGen) {
    
    $scope.CONFIG = $window.DIARY_CONFIG;
    
    $scope.diary_entries = [];
    $scope.diary_questions = [];
    $scope.locations = [];
    $scope.emojis = [];
    
    /* DISCLAIMER AND AUTHENTICATION */
   
    $scope.disclaimer_read = !$scope.CONFIG.show_disclaimer || (!!$window.localStorage.getItem('disclaimer_read') || '');
    $scope.auth_code = $window.localStorage.getItem('user_code') || '';
      
    $scope.authenticate = function() {
        $scope.auth_code = $scope.auth_code.toUpperCase();
        var promise = $http.post('login',{"user_code": $scope.auth_code});
        console.log('Logging in with '+$scope.auth_code);
        promise.success(function(data) {
            if (data.authenticated) {
                $window.localStorage.setItem('user_code',$scope.auth_code);
                $window.history.pushState({name:'home'},'','#home');
                $scope.authenticated = true;
                $scope.diary_entries = data.diary_entries;
            } else {
                $window.alert('Login failed');
            }
        });
        promise.error(function(data,error) {
            $window.alert('Connection failed.\nPlease retry later');
        });
    };
    
    $scope.autologin = function() {
        if ($scope.CONFIG.auto_login) {
            if ($scope.auth_code) {
                $scope.authenticate();
            } else {
                $scope.auth_code = idGen.get();
                $scope.authenticate();
            }
        }
    };
    
    $scope.generatePasscode = function() {
        var promise = $http.get('passcode');
        promise.success(function(data) {
            $scope.auth_code = data;
        });
    };
    
    $scope.logout = function() {
        $scope.authenticated = false;
        $window.localStorage.removeItem('user_code');
    };
    
    $scope.agreeDisclaimer = function() {
        $scope.disclaimer_read = true;
        $window.localStorage.setItem('disclaimer_read','1');
        $scope.autologin();
    };
    
    $scope.declineDisclaimer = function() {
        $window.alert($scope.CONFIG.decline_message);
    };
    
    if ($scope.disclaimer_read) {
        $scope.autologin();
    }
       
    [
        'diary_questions',
        'locations',
        'emojis',
    ].forEach(function(key) {
        switch (typeof $scope.CONFIG[key]) {
            case "string":
                var promise = $http.get($scope.CONFIG[key]);
                promise.success(function(data) {
                    $scope[key] = data;
                });
            break;
            case "object":
                $scope[key] = $scope.CONFIG[key];
            break;
        }
    });
    
    $scope.editing_user_data = null;
    $scope.editing_item = null;
    
    /* CODE FOR MANAGING CONNECTIVITY */
    
    var requestQueue = [],
        nextRequest = 0;
    
    function processQueue() {
        if (!requestQueue.length) {
            nextRequest = 0;
            return;
        }
        
        nextRequest += 30000;
        
        console.log(requestQueue.length + ' items to process');
        
        function deleteItemFromQueue(item) {
            var ix = requestQueue.indexOf(item);
            if (ix !==  -1) {
                requestQueue.splice(ix,1);
            }
            if (!requestQueue.length) {
                console.log('Queue is empty');
                nextRequest = 0;
            }
        }
        
        requestQueue.forEach(function(req) {
            var promise = $http[req.method].apply($http,req.arguments);
            req.attempts = (1 + (req.attempts || 0));
            promise.success(function(data) {
                console.log('success', data);
                deleteItemFromQueue(req);
            });
            promise.error(function(data, status) {
                console.log('Error ' + status + ' at attempt #'+req.attempts);
                if (req.attempts > 30) {
                    console.log('Too many attemps, cancelled');
                    deleteItemFromQueue(req);
                } else {
                    console.log('Will be re-processed in '+((nextRequest-Date.now())/1000).toFixed(1)+'s');
                }
            });
        });
    }
    
    function addRequest(req) {
        requestQueue.push(req);
        if (!nextRequest) {
            nextRequest = Date.now();
        }
    }
    
    $window.setInterval(function() {
        if (nextRequest && (Date.now() > nextRequest)) {
            processQueue();
        }
    },1000);
    
    /* CODE FOR DATE SELECTOR */
    
    var months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
        ];
    
    $scope.daylabels = [
        'Mo',
        'Tu',
        'We',
        'Th',
        'Fr',
        'Sa',
        'Su'
    ];
    $scope.months = [];
    
    var minDate = new Date($scope.CONFIG.start_date + 'T12:00:00.000Z').valueOf(),
        maxDate = new Date($scope.CONFIG.end_date + 'T12:00:00.000Z').valueOf(),
        DAY_SPAN = 24*60*60*1000,
        currentMonth = null,
        currentWeek = null,
        today = Math.floor(Date.now()/DAY_SPAN);
    
    function completeWeek(d) {
        var k = d;
        if (currentWeek) {
            while (currentWeek.length < 7) {
                k += DAY_SPAN;
                var dd = new Date(k);
                currentWeek.push({
                    label: dd.getUTCDate(),
                    active: false
                });
            }
        }
    }
    
    $scope.today_within_range = (today >= Math.floor(minDate/DAY_SPAN) && today <= Math.floor(maxDate/DAY_SPAN));
    
    for (var d = minDate; d <= maxDate; d += DAY_SPAN) {
        var dt = new Date(d),
            m = dt.getUTCMonth();
        if (m !== (currentMonth||{}).month_number) {
            completeWeek(d);
            currentMonth = {
                month_number: m,
                label: months[m] + ' ' + dt.getUTCFullYear(),
                weeks: []
            };
            currentWeek = [];
            currentMonth.weeks.push(currentWeek);
            $scope.months.push(currentMonth);
            var w = (8+dt.getUTCDay())%7;
            for (var i = 0; i < w; i++) {
                var dn = d - (w-i)*DAY_SPAN,
                    dd = new Date(dn);
                currentWeek.push({
                    label: dd.getUTCDate(),
                    active: false
                });
            }
        }
        if (currentWeek.length >= 7) {
            currentWeek = [];
            currentMonth.weeks.push(currentWeek);
        }
        currentWeek.push({
            date: dt.toISOString().substr(0,10),
            label: dt.getUTCDate(),
            active: true,
            today: (today === Math.floor(d/DAY_SPAN))
        });
    }
    completeWeek(d);
    
    $scope.setDate = function(d) {
        if (d === null) {
            $scope.editing_user_data.date = '';
        }
        if (d && d.active) {
            $scope.editing_user_data.date = d.date;
        }
    };
    
    $scope.setToday = function() {
        $scope.editing_user_data.date = (new Date).toISOString().substr(0,10);
    };
    
    /* CODE FOR ADDING/EDITING ENTRIES */
    
    var user_data_generator = {
        comment: "",
        image: "",
        thumbnail: '',
        original_media: '',
        media_type: '',
        upload_id: '',
        date: '',
        emojis: '',
        latitude: null,
        longitude: null,
        location: null
    };
        
    $scope.editEntry = function(item, block_history) {
        $scope.getLocation();
        $scope.editing_item = item;
        $scope.editing_user_data = {};
        for (key in user_data_generator) {
            $scope.editing_user_data[key] = item[key];
        }
        $scope.image_status = item.upload_id ? 'Uploading' : '';
        $timeout(function() {
            $scope.$broadcast('update_lightbox');
        });
        if (!block_history) {
            $window.history.pushState({
                name:'edit',
                editing_id:item._id
            },'','#edit');
        }
    };
    
    $scope.addEntry = function(question) {
        if ($scope.CONFIG.max_entries && ($scope.diary_entries.length >= $scope.CONFIG.max_entries)) {
            alert("You've reached the maximum number of entries ("+$scope.CONFIG.max_entries+")");
            return;
        }
        var entry = angular.copy(user_data_generator);
        console.log(entry);
        entry._id = idGen.get();
        entry.question = question;
        entry.created_date = (new Date()).toISOString();
        $scope.editEntry(entry);
    };
    
    $window.onpopstate = function(event) {
        if (event.state && event.state.name && $scope.authenticated) {
            $scope.$apply(function() {
                switch(event.state.name) {
                    case ('home'):
                        $scope.cancelEditing(true);
                    break;
                    case ('edit'):
                        var _id = event.state.editing_id,
                            entry = undefined;
                        for (var i = 0, l = $scope.diary_entries.length; i < l; i++) {
                            if ($scope.diary_entries[i]._id === _id) {
                                entry = $scope.diary_entries[i];
                                break;
                            }
                        }
                        if (entry) {
                            $scope.editEntry(entry, true);
                        }
                    break;
                }
            });
        }
        
    };
    
    $scope.cancelEditing = function(block_history) {
        $scope.editing_user_data = null;
        $scope.editing_item = null;
        if (!block_history) {
            $window.history.pushState({name:'home'},'','#home');
        }
    };
    
    $scope.saveItem = function() {
        var item = $scope.editing_item,
            missing_mandatory_items = [];
        [
            [ "comment", $scope.CONFIG.show_comment_block && $scope.CONFIG.make_comment_mandatory, "Text comment" ],
            [ "image", $scope.CONFIG.show_media_block && $scope.CONFIG.make_media_mandatory, "Image upload" ],
            [ "date", $scope.CONFIG.show_calendar_block && $scope.CONFIG.make_date_mandatory, "Date" ],
            [ "emojis", $scope.CONFIG.show_emoji_block && $scope.CONFIG.make_emoji_mandatory, "Emotion(s)" ],
            [ "location", $scope.CONFIG.show_location_block && $scope.CONFIG.make_location_mandatory, "Location" ]
        ].forEach(function(t) {
            if (!$scope.editing_user_data[t[0]] && t[1]) {
                missing_mandatory_items.push(t[2]);
            }
        });
        if (missing_mandatory_items.length) {
            var msg = (missing_mandatory_items.length === 1 ? "The following mandatory item is missing:" : "The following mandatory items are missing:");
            alert(msg + "\n" + missing_mandatory_items.join(", "));
            return;
        }
        for (key in user_data_generator) {
            item[key] = $scope.editing_user_data[key];
        }
        item.user_code = $scope.auth_code;
        item.modified_date = (new Date()).toISOString();
        if ($scope.diary_entries.indexOf(item) === -1) {
            $scope.diary_entries.push(item);
        }
        $scope.postItem(item);
        $scope.cancelEditing();
    };
    
    $scope.postItem = function(item) {
        addRequest({
            method: 'post',
            arguments: [
                'entry',
                angular.toJson(item)
            ]});
    };
    
    $scope.deleteItem = function() {
        addRequest({
            method: 'delete',
            arguments: [ 'entry/'+$scope.editing_item._id ]
        });
        var ix = $scope.diary_entries.indexOf($scope.editing_item);
        if (ix !== -1) {
            $scope.diary_entries.splice(ix,1);
        }
        $scope.cancelEditing();
    };
    
    $scope.removeImage = function() {
        $scope.editing_user_data.upload_id = '';
        $scope.editing_user_data.image = '';
        $scope.editing_user_data.thumbnail = '';
        $scope.image_status = '';
    };
      
    /* CODE FOR HANDLING LOCATION */
    
    function haversine(start, end) {
        var radius = 6371000,
            rads = Math.PI/180,
            dLat = rads * (end.latitude - start.latitude),
            dLon = rads * (end.longitude - start.longitude),
            lat1 = rads * (start.latitude),
            lat2 = rads * (end.latitude),
            a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2),
            c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
        return radius * c;
    }
    function updateDistances() {
        if ($scope.locations) {
            if ($scope.CONFIG.use_geolocation && $scope.coords) {
                $scope.locations.forEach(function(location) {
                    location.distance = haversine({
                        latitude: location.latitude,
                        longitude: location.longitude
                    }, $scope.coords);
                });
            } else {
                $scope.locations.forEach(function(location) {
                    delete location.distance;
                });
            }
        }
    };
    function locationSuccess(pos) {
        $scope.$apply(function() {
            $scope.coords = pos.coords;
            updateDistances();
            $scope.$broadcast("locationfound");
        });
    }
    function locationError() {
        $scope.$apply(function() {
            $scope.coords = null;
            updateDistances();
            $scope.$broadcast("locationerror");
        });
    }
    $scope.getLocation = function() {
        if (!$scope.CONFIG.use_geolocation) {
            return;
        }
        $window.navigator.geolocation.getCurrentPosition(locationSuccess, locationError, {
            timeout: 10*1000,
            watch: false
        });
    };
    $scope.setPositionGPS = function() {
        $scope.editing_user_data.location = "Geolocation [" + $scope.coords.latitude.toFixed(5) + "," + $scope.coords.longitude.toFixed(5) + "]",
        $scope.editing_user_data.latitude = $scope.coords.latitude;
        $scope.editing_user_data.longitude = $scope.coords.longitude;
    };
    $scope.setPositionLocation = function(location) {
        $scope.editing_user_data.location = location.name;
        $scope.editing_user_data.latitude = location.latitude;
        $scope.editing_user_data.longitude = location.longitude;
        $scope.show_location_list = false;
    };
    $scope.panToPosition = function() {
        if ($scope.editing_user_data.location && $scope.map) {
            $scope.map.panTo([$scope.editing_user_data.latitude,$scope.editing_user_data.longitude]);
        }
    };
    $scope.removePosition = function() {
        $scope.editing_user_data.location = null;
        $scope.editing_user_data.latitude = null;
        $scope.editing_user_data.longitude = null;
    };
    
    /* CODE FOR HANDLING EMOJIS */
    
    $scope.hasEmoji = function(emoji) {
        return ((($scope.editing_user_data || {}).emojis || '').indexOf(emoji) !== -1);
    };
    $scope.toggleEmoji = function(emoji) {
        if ($scope.hasEmoji(emoji)) {
            $scope.editing_user_data.emojis = $scope.editing_user_data.emojis.replace(emoji,'');
        } else {
            $scope.editing_user_data.emojis += emoji; 
        }
    };
    
    $scope.$on('mapready', function() {
        var map = $scope.map,
            icon = $window.L.AwesomeMarkers.icon({
                markerColor: 'orange'
            }),
            marker = $window.L.marker(
                map.getCenter(),
                {
                    icon: icon,
                    zIndexOffset: 1000
                }),
            container = map.getContainer();
        marker.setOpacity(0);
        marker.addTo(map);
        
        var mousecoords = null,
            addPinTimeout = null;
            
        function getEventXY(evt) {
            if (evt.touches) {
                var a = Array.prototype.slice.call(evt.touches),
                    l = a.length,
                    r =  a.reduce( function(m,v) {
                        m.x += v.clientX;
                        m.y += v.clientY;
                        return m;
                    }, {x:0, y:0});
                r.x /= l;
                r.y /= l;
            } else {
                r = { x: evt.clientX, y: evt.clientY };
            }
            var p = container.getBoundingClientRect();
            r.x -= p.left;
            r.y -= p.top;
            return r;
        }
        
        function undrop() {
            $timeout.cancel(addPinTimeout);
            mousecoords = null;
            $scope.dropping_pin = false;
        }
        
        function mousedown(evt) {
            mousecoords = getEventXY(evt);
            var latlng = map.containerPointToLatLng([mousecoords.x, mousecoords.y]);
            $scope.$apply(function() {
                $scope.dropping_pin = true;
            });
            addPinTimeout = $timeout(function() {
                $scope.editing_user_data.location = "Dropped pin [" + latlng.lat.toFixed(5) + "," + latlng.lng.toFixed(5) + "]";
                $scope.editing_user_data.latitude = latlng.lat;
                $scope.editing_user_data.longitude = latlng.lng;
                undrop();
            },800);
        }
        container.addEventListener('mousedown', mousedown, false);
        container.addEventListener('touchstart', mousedown, false);
        
        function mousemove(evt) {
            if (mousecoords) {
                var newcoords = getEventXY(evt),
                    dx = newcoords.x - mousecoords.x,
                    dy = newcoords.y - mousecoords.y,
                    drift = (dx*dx+dy*dy);
                if (drift > 16) {
                    $scope.$apply(undrop);
                }
            }
        }
        container.addEventListener('mousemove', mousemove, false);
        container.addEventListener('touchmove', mousemove, false);
        
        function mouseup() {
            $scope.$apply(undrop);
        }
        container.addEventListener('mouseup', mouseup, false);
        container.addEventListener('touchend', mouseup, false);
        
        $scope.$watch('editing_user_data.location', function() {
            if ($scope.editing_user_data && $scope.editing_user_data.location) {
                marker.setLatLng([$scope.editing_user_data.latitude,$scope.editing_user_data.longitude]);
                marker.setOpacity(1);
            } else {
                marker.setOpacity(0);
            }
        });
        
        if ($scope.CONFIG.show_locations_on_map) {
            var locationmarkers = [];
            $scope.$watch('locations', function() {
                locationmarkers.forEach(function(l) {
                    l.matching_location = false;
                });
                $scope.locations.forEach(function(l) {
                    if (!l.marker) {
                        var icon = $window.L.AwesomeMarkers.icon({
                            markerColor: l.color || 'blue',
                            prefix: 'fa',
                            icon: l.icon || ''
                        });
                        l.marker = $window.L.marker(
                            [l.latitude, l.longitude],
                            {icon: icon}
                        );
                        l.marker.addTo(map);
                        l.marker.matching_location = true;
                        locationmarkers.push(l.marker);
                        l.marker.on('click', function() {
                            $scope.$apply(function() {
                                undrop();
                                $scope.editing_user_data.location = l.name;
                                $scope.editing_user_data.latitude = l.latitude;
                                $scope.editing_user_data.longitude = l.longitude;
                            });
                        });
                    }
                });
                locationmarkers.forEach(function(l) {
                    if (!l.matching_location) {
                        map.removeLayer(l);
                    }
                });
            });
        
        }
        
    });
    
}]);

diaryApp.filter('fieldBool', function() {
    return function(items,fieldname,iswhat) {
        return items.filter(function(item) {
            var isnt = !item[fieldname];
            return (iswhat ? !isnt : isnt);
        });
    };
});

diaryApp.filter('paragraphy', function() {
    return function(text) {
        var div = document.createElement('div');
        (text||"").split(/[\r\n]+/).filter(function(t) {
            return t.length;
        }).forEach(function(t) {
            var p = document.createElement('p');
            p.textContent = t;
            div.appendChild(p);
        });
        return div.innerHTML;
    };
});

diaryApp.directive("emoji", function() {
    return {
        link: function(scope, element, attrs) {
            scope.$watch(attrs.emoji, function(val) {
                element.html(window.twemoji.parse(val));
            });
        }
    };
});

diaryApp.directive("dropImage", [ '$window', 'idGen',
function($window, idGen) {
    /* This directive controls the image drag/drop + browse file form */
    return {
        link: function(scope, element, attrs) {
            element.bind('dragenter',  function(event) {
                /* The "dragenter" event has to be intercepted for drop to work correctly */
                event.preventDefault();
//                event.dataTransfer.setData("text/plain","");
                event.dataTransfer.effectAllowed = 'copy';
                scope.$apply(function() {
                    scope.dragging = true;
                });
            });
            element.bind('dragover', function(event) {
                /* The "dragover" event has to be intercepted for drop to work correctly */
                event.preventDefault();
                scope.$apply(function() {
                    scope.dragging = true;
                });
            });
            element.bind('dragleave', function(event) {
                event.preventDefault();
                scope.$apply(function() {
                    scope.dragging = false;
                });
            });
            
            function readFile(file) {
                /* This is the callback triggered when opening a file,
                 * either from drag-and-drop or browsing file */
                if (!file) {
                    $window.console.log("No file");
                    scope.$apply(function() {
                        scope.image_status = 'No file found.';
                    });
                    return;
                }
                var ftypeparts = file.type.split("/");
                if (ftypeparts[0] !== "image" && ftypeparts[0] !== "video") {
                    /* If the file is not an image, we discard it */
                    $window.console.log("Not an image or video");
                    scope.$apply(function() {
                        scope.image_status = 'This is not an image nor a video.';
                    });
                    return;
                }
                var _MAXSIZE_MB = (( scope.CONFIG || {} ).maximum_upload_size || 10);
                if (file.size > _MAXSIZE_MB*1024*1024) {
                    /* If the image is too large (over n MB), we discard it
                     * This is an arbitrary limit, and there is no limit
                     * for images referred to by their URLs rather than embedded
                     * (which is the case for local file system images) */
                    $window.console.log("Image too large");
                    scope.$apply(function() {
                        scope.image_status = 'This file is too large (must be less than ' + _MAXSIZE_MB + 'MB).';
                    });
                    return;
                }
                
                var upload_id = scope.editing_user_data.upload_id = idGen.get(),
                    attempts = 0;
                
                function sendFile() {
                    attempts++;
                    var data = new FormData();
                    data.append('_id',upload_id);
                    data.append('image',file);
                    var xhr = new XMLHttpRequest();
                    function callback(evt) {
                        console.log(xhr);
                        var entry = undefined,
                            status = xhr.status;
                        if (scope.editing_user_data && upload_id === scope.editing_user_data.upload_id) {
                            entry = scope.editing_user_data;
                        } else {
                            scope.diary_entries.forEach(function(e) {
                                if (e.upload_id === upload_id) {
                                    entry = e;
                                }
                            });
                        }
                        console.log(entry, status, upload_id);
                        if (entry) {
                            if (status === 200) {
                                var res = JSON.parse(xhr.responseText);
                                console.log(res);
                                scope.$apply(function() {
                                    entry.media_type = res.media_type;
                                    entry.original_media = res.original;
                                    entry.image = res.image;
                                    entry.thumbnail = res.thumbnail;
                                    entry.upload_id = '';
                                    if (entry === scope.editing_user_data) {
                                        scope.image_status = 'Upload successful.';
                                    } else {
                                        scope.postItem(entry);
                                    }
                                });
                            } else {
                                if (attempts < 5) {
                                    console.log('Upload failed, will try again in 30s');
                                    window.setTimeout(sendFile,30000);
                                }
                            }
                        }
                    }
                    xhr.addEventListener('load', callback, false);
                    xhr.addEventListener('error', callback, false);
                    xhr.open('POST','media-uploader');
                    xhr.send(data);
                }
                
                sendFile();
                
                scope.$apply(function() {
                    scope.image_status = 'Uploading ' + ftypeparts[0];
                });
                
            }
            
            element.bind('drop', function(event) {
                /* Triggered when something is dropped on the image */
                event.preventDefault();
                scope.$apply(function() {
                    scope.dragging = false;
                });
                if (event.dataTransfer.files.length) {
                    /* Is there a file that has been dropped?
                     * If yes, try to read it */
                    readFile(event.dataTransfer.files[0]);
                    return;
                }
                var htmldata = event.dataTransfer.getData("text/html");
                if (htmldata) {
                    /* Is there a HTML snippet being dropped?
                     * If yes, let's try to find an <img> tag inside */
                    var imgsrc = $window.angular.element('<div>').html(htmldata).find("img").attr("src");
                    if (imgsrc) {
                        scope.$apply(function() {
                            scope.editing_user_data.image = imgsrc;
                            scope.image_status = 'Image from external source.';
                        });
                        return;
                    }
                }
                /* Otherwise, we can't process what has been dropped */
                console.log("No file or HTML Data. Data types are: ",event.dataTransfer.types);
                scope.$apply(function() {
                    scope.editing_user_data.image = "";
                    scope.image_status = 'No valid image found.';
                });
            });
            
            var input = element.find("input");
            
            element.bind('click', function(event) {
                if (event.target !== input[0]) {
                    input[0].click();
                }
            });
            input.bind('change', function(event) {
                /* If the user goes through the file input, we try to read the file from there */
                event.preventDefault();
                readFile(input[0].files[0] || null);
            });
        }
    };
}]);

diaryApp.directive('emRef', [ '$window', function($window) {
    return {
        link: function(scope, element, attrs) {
            function updateEmRef() {
                var w = element[0].parentElement.getBoundingClientRect().width;
                element[0].style.fontSize = (Math.max(w/25,8)) + 'px';
            }
            updateEmRef();
            $window.addEventListener('resize', updateEmRef, false);
            scope.$on('update_lightbox',updateEmRef);
        }
    };
}]);

diaryApp.directive("focusOn", function() {
    return {
        link: function(scope, element, attrs) {
            scope.$watch(attrs.focusOn, function(val) {
                if (val) {
                    window.setTimeout(function() {
                        element[0].focus();
                    });
                }
            });
        }
    };
});

diaryApp.directive("lightboxScrollup", function() {
    return {
        link: function(scope, element) {
            scope.$on('update_lightbox', function() {
                element[0].scrollTop = 0;
            });
        }
    };
});

diaryApp.directive("scrollFocus", function() {
    return {
        link: function(scope, element, attrs) {
            function goScroll() {
                var el = element[0],
                    scrollParent = el.offsetParent,
                    elTop = el.getBoundingClientRect().top;
                if (scrollParent) {
                    scrollParent.scrollTop = (scrollParent.scrollTop + elTop - 20);
                }
            }
            element.bind('focus', goScroll);
            window.addEventListener('resize', function() {
                if (window.document.activeElement === element[0]) {
                    goScroll();
                }
            }, false);
        }
    };
});

diaryApp.filter('nameContains', function() {
    return function(items, searchstring) {
        if (!searchstring || searchstring.length <2) {
            return items;
        }
        var s = searchstring.toLowerCase();
        return items.filter(function(item) {
            return (item.name.toLowerCase().indexOf(s) !== -1);
        });
    };
});

diaryApp.filter('dstString', function() {
    return function(item) {
        var m = parseInt(item);
        if (m === NaN) {
            return item;
        }
        if (m < 1000) {
            return m + " metres";
        } else {
            return (m/1000).toFixed(1) + " km";
        }
        return m;
    };
});

diaryApp.directive("leaflet", ['$window', function($window) {
    return {
        link: function(scope, element, attrs) {
            var L = $window.L;
            var config = $window.DIARY_CONFIG;
            var map = scope.map = L.map(element[0])
                .setView([config.map_coords.latitude,config.map_coords.longitude], config.map_coords.zoom);
            L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);
            var locatebutton = L.control({
                position: 'topright'
            });
            locatebutton.onAdd = function(map) {
                var div = L.DomUtil.create('div', 'leaflet-control leaflet-bar'),
                    a = L.DomUtil.create('a', 'locate-button fa fa-lg fa-dot-circle-o', div);
                div.style.display = "none";
                a.href = "#";
                a.addEventListener('click', function(evt) {
                    if (scope.coords) {
                        map.panTo([scope.coords.latitude,scope.coords.longitude]);
                    }
                    evt.preventDefault();
                }, false);
                return div;
            };
            locatebutton.addTo(map);
            var locCircle = L.circle([config.map_coords.latitude,config.map_coords.longitude],10,{
                color: "#0000cc",
                opacity: 0,
                fillOpacity: 0,
                weight: 3
            });
            locCircle.addTo(map);
            scope.$on('locationfound', function() {
                locatebutton._container.style.display = "block";
                locCircle.setStyle({
                    opacity: .8,
                    fillOpacity: .2,
                }).setLatLng([scope.coords.latitude,scope.coords.longitude]).setRadius(scope.coords.accuracy);
            });
            scope.$on('locationerror', function() {
                locatebutton._container.style.display = "none";
                locCircle.setStyle({
                    opacity: 0,
                fillOpacity: 0,
                });
            });
            scope.$broadcast('mapready');
            function updateMapWidth() {
                map.invalidateSize();
            }
            $window.addEventListener('resize', updateMapWidth, false);
            scope.$on('update_lightbox', updateMapWidth);
        }
    };
}]);

