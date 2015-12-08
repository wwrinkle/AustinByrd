var app = angular.module('AustinByrdApp', ['ngRoute', 'ngAnimate', 'ui.bootstrap', 'duScroll']);

app.directive('offClick', ['$rootScope', '$parse', function($rootScope, $parse) {
    var id = 0;
    var listeners = {};
    document.addEventListener("touchend", offClickEventHandler, true);
    document.addEventListener('click', offClickEventHandler, true);

    function targetInFilter(target, elms) {
        if (!target || !elms) return false;
        var elmsLen = elms.length;
        for (var i = 0; i < elmsLen; ++i)
            if (elms[i].contains(target)) return true;
        return false;
    }

    function offClickEventHandler(event) {
        var target = event.target || event.srcElement;
        angular.forEach(listeners, function(listener, i) {
            if (!(listener.elm.contains(target) || targetInFilter(target, listener.offClickFilter))) {
                $rootScope.$evalAsync(function() {
                    listener.cb(listener.scope, {
                        $event: event
                    });
                })
            }
        });
    }
    return {
        restrict: 'A',
        compile: function($element, attr) {
            var fn = $parse(attr.offClick);
            return function(scope, element) {
                var elmId = id++;
                var offClickFilter;
                var removeWatcher;
                offClickFilter = document.querySelectorAll(scope.$eval(attr.offClickFilter));
                if (attr.offClickIf) {
                    removeWatcher = $rootScope.$watch(function() {
                        return $parse(attr.offClickIf)(scope);
                    }, function(newVal) {
                        if (newVal) {
                            on();
                        } else if (!newVal) {
                            off();
                        }
                    });
                } else {
                    on();
                }
                attr.$observe('offClickFilter', function(value) {
                    offClickFilter = document.querySelectorAll(scope.$eval(value));
                });
                scope.$on('$destroy', function() {
                    off();
                    if (removeWatcher) {
                        removeWatcher();
                    }
                });

                function on() {
                    listeners[elmId] = {
                        elm: element[0],
                        cb: fn,
                        scope: scope,
                        offClickFilter: offClickFilter
                    };
                }

                function off() {
                    delete listeners[elmId];
                }
            };
        }
    };
}]);
app.directive('elastic', [
    '$timeout',
    function($timeout) {
        return {
            restrict: 'A',
            link: function($scope, element) {
                $scope.initialHeight = $scope.initialHeight || element[0].style.height;
                var resize = function() {
                    element[0].style.height = $scope.initialHeight;
                    element[0].style.height = "" + element[0].scrollHeight + "px";
                };
                element.on("blur keyup change", resize);
                $timeout(resize, 0);
            }
        };
    }
]);
app.directive('pullDown', function($timeout, $window) {
    return {
        restrict: 'A',
        link: function($scope, element) {
            $timeout(function() {
                $scope.$watchGroup(['isOpenUpcomingNumber', 'isOpenPastNumber'], function(newValue, oldValue) {
                    var windowWidth = $window.innerWidth;
                    var windowBool = windowWidth > 767;
                    var parent = element.parent();
                    var grandParent = parent.parent();
                    var child = element.children();
                    var childHeight = child[0].offsetHeight;

                    $timeout(function() {
                        if (windowBool && grandParent[0].offsetHeight - childHeight > 0) {
                            var grandParentHeight = grandParent[0].offsetHeight;
                            child.css('margin-top', grandParentHeight - childHeight + 'px');
                        } else {
                            child.css('margin-top', 0);
                        }
                    }, 125);
                });
            }, 0);
        }
    };
});
app.config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
    $routeProvider
        .when('/', {
            templateUrl: 'views/home.html',
            controller: 'HomeController'
        })
        .when('/about', {
            templateUrl: 'views/about.html',
            controller: 'AboutController'
        })
        .when('/calendar', {
            templateUrl: 'views/calendar.html',
            controller: 'CalendarController'
        })
        .when('/music', {
            templateUrl: 'views/music.html',
            controller: 'MusicController'
        })
        .when('/videos', {
            templateUrl: 'views/videos.html',
            controller: 'VideosController'
        })
        .when('/contact', {
            templateUrl: 'views/contact.html',
            controller: 'ContactController'
        })
        .otherwise({
            redirectTo: '/'
        });
    $locationProvider.html5Mode(true);
}]);
app.factory('socialMedia', function($q, $http, $sce, $filter) {
    var facebookStatuses = [];
    var tweets = [];
    var socialMedia = [];
    var socialMediaDeferred = $q.defer();
    var urlRemove = function(string, url) {
        var urlStringIndex = string.search(url);
        var textBeforeUrl = string.substr(0, urlStringIndex);
        var textAfterUrl = string.substr(urlStringIndex + (url.length + 11));
        return textBeforeUrl.concat(textAfterUrl);
    };
    $q.all([
        $http.get('/facebook').
        then(function(response) {
            for (var i = 0; i < response.data.length; i++) {
                var status = {};
                status.platform = 'Facebook';
                status.text = response.data[i].message;
                if (!status.text) {
                    status.text = response.data[i].name + ' ' + response.data[i].description;
                }
                if (status.text.search('http://t.co') != -1) {
                    status.text = urlRemove(status.text, 'http://t.co');
                }
                if (status.text.search('https://t.co') != -1) {
                    status.text = urlRemove(status.text, 'https://t.co');
                }
                if (response.data[i].picture && response.data[i].picture.search('newp') == -1 && response.data[i].picture.search('sndcdn.com') == -1) {
                    status.imgUrl = response.data[i].picture;
                }
                status.url = response.data[i].actions[0].link;
                status.date = new Date(response.data[i].created_time);
                facebookStatuses.push(status);
            }
        }, function(response) {}),
        $http.get('/twitter').
        then(function(response) {
            var tweetsLength = Object.keys(response.data).length - 3;
            for (var i = 0; i < tweetsLength; i++) {
                var tweet = {};
                tweet.platform = 'Twitter';
                tweet.text = response.data[i].text;
                tweet.url = 'https://twitter.com/austinbyrdjazz/status/' + response.data[i].id_str + '/';
                tweet.date = new Date(response.data[i].created_at);
                if (response.data[i].entities.media) {
                    tweet.imgUrl = response.data[i].entities.media[0].media_url_https;
                    tweet.text = urlRemove(tweet.text, 'http://t.co');
                }
                if (response.data[i].entities.urls.length) {
                    if (response.data[i].entities.urls[0].display_url.slice(0, 8) == 'youtu.be') {
                        tweet.youtubeUrl = response.data[i].entities.urls[0].expanded_url;
                        var youtubeId = response.data[i].entities.urls[0].display_url.slice(9);
                        tweet.youtubeEmbedUrl = $sce.trustAsResourceUrl('http://www.youtube.com/embed/' + youtubeId + '?origin=http://austinbyrd.com');
                        tweet.text = urlRemove(tweet.text, 'http://t.co');
                    }
                    if (response.data[i].entities.urls[0].display_url.slice(0, 14) == 'soundcloud.com') {
                        tweet.soundcloudUrl = response.data[i].entities.urls[0].expanded_url;
                        if (tweet.text.search('http://t.co') != -1) {
                            tweet.text = urlRemove(tweet.text, 'http://t.co');
                        }
                        if (tweet.text.search('https://t.co') != -1) {
                            tweet.text = urlRemove(tweet.text, 'https://t.co');
                        }
                    }
                    if (response.data[i].entities.urls[0].display_url.slice(0, 14) == 'austinbyrd.com') {
                        tweet.byrdUrl = response.data[i].entities.urls[0].expanded_url;
                        tweet.text = urlRemove(tweet.text, 'http://t.co');
                    }
                }
                tweets.push(tweet);
            }
        }, function(response) {}),
    ]).then(function() {
        socialMedia = facebookStatuses.concat(tweets);
        socialMedia = $filter('orderBy')(socialMedia, 'date', true);
        for (var i = 1; i < socialMedia.length; i++) {
            if (socialMedia[i].text == socialMedia[i - 1].text) {
                socialMedia.splice(i - 1, 1);
            }
        }
        socialMediaDeferred.resolve(socialMedia);
    });
    return socialMediaDeferred.promise;
});
app.factory('calendar', function($rootScope, $q, $http, $filter) {
    var calendarDeffered = $q.defer();
    $http.get('/getCalendar').
    then(function(response) {
        var calendar = {};
        calendar.upcomingGigs = [];
        calendar.pastGigs = [];
        var todaysDate = new Date();
        var monthFromToday = new Date().setTime(todaysDate.getTime() + (31 * 864e5));
        for (var i = response.data.items.length - 1; i >= 0; i--) {
            if (response.data.items[i].recurringEventId && new Date(response.data.items[i].start.dateTime) > monthFromToday) {
                response.data.items.splice(i, 1);
            } else if (new Date(response.data.items[i].end.dateTime) >= todaysDate) {
                calendar.upcomingGigs.push(response.data.items[i]);
            } else {
                calendar.pastGigs.push(response.data.items[i])
            }
        }
        calendar.upcomingGigs = $filter('orderBy')(calendar.upcomingGigs, 'end.dateTime', false);
        calendar.pastGigs = $filter('orderBy')(calendar.pastGigs, 'end.dateTime', true);
        calendarDeffered.resolve(calendar);
    }, function(response) {});
    return calendarDeffered.promise;
});
app.factory('biography', function($q, $http) {
    var biographyDeffered = $q.defer();
    $http.get('https://spreadsheets.google.com/feeds/list/1Bj85cPKefje7TeeIxz6Tq9syf6eap1utmLXdL0VeMX4/1/public/basic?alt=json')
        .then(function(response) {
            var paragraphs = [];
            for (var i = 0; i < response.data.feed.entry.length; i++) {
                var paragraphObj = {
                    text: response.data.feed.entry[i].title.$t
                };
                paragraphs.push(paragraphObj);
            }
            biographyDeffered.resolve(paragraphs);
        }, function(response) {});
    return biographyDeffered.promise;
});
app.factory('videos', function($q, $http) {
    var videosDeffered = $q.defer();
    $http.get('https://spreadsheets.google.com/feeds/list/1Bj85cPKefje7TeeIxz6Tq9syf6eap1utmLXdL0VeMX4/2/public/basic?alt=json')
        .then(function(response) {
            var videos = [];
            for (var i = 0; i < response.data.feed.entry.length; i++) {
                var videoObj = {};
                videoObj.description = response.data.feed.entry[i].title.$t;
                var dataString = response.data.feed.entry[i].content.$t;
                var urlIndex = dataString.indexOf('url:');
                videoObj.url = dataString.substring(urlIndex + 5);
                var idPosition = videoObj.url.search('watch') + 8;
                videoObj.id = videoObj.url.slice(idPosition);
                videoObj.title = dataString.substring(7, urlIndex - 2);
                videos.push(videoObj);
            }
            videosDeffered.resolve(videos);
        })
        /*$http.get('getVideos').
        then(function(response) {
            for (var i = 0; i < response.data.length; i++) {
                var idPosition = response.data[i].videoUrl.search('watch') + 8;
                response.data[i].videoId = response.data[i].videoUrl.slice(idPosition);
            }
            console.log(response.data);
            videosDeffered.resolve(response.data);
        }, function(response) {});*/
    return videosDeffered.promise;
});
app.factory('audio', function($q, $http) {
    var audioDeffered = $q.defer();
    var albums = [];
    $q.all([
        $http.get('https://spreadsheets.google.com/feeds/list/1Bj85cPKefje7TeeIxz6Tq9syf6eap1utmLXdL0VeMX4/3/public/basic?alt=json')
        .then(function(response) {
            for (var i = 0; i < response.data.feed.entry.length; i++) {
                var albumObj = {};
                albumObj.albumName = response.data.feed.entry[i].title.$t;
                var dataString = response.data.feed.entry[i].content.$t;
                var descriptionIndex = dataString.indexOf('description:');
                albumObj.albumDescription = dataString.substring(descriptionIndex + 13);
                albumObj.albumImg = dataString.substring(5, descriptionIndex - 2);
                albumObj.tracks = [];
                albums.push(albumObj);
            }
        }),
    ]).then(function() {
        $http.get('https://spreadsheets.google.com/feeds/list/1Bj85cPKefje7TeeIxz6Tq9syf6eap1utmLXdL0VeMX4/4/public/basic?alt=json')
            .then(function(response) {
                for (var j = 0; j < response.data.feed.entry.length; j++) {
                    var trackObj = {};
                    trackObj.trackName = response.data.feed.entry[j].title.$t;
                    trackObj.oogUrl = 'audio/' + trackObj.trackName + '.ogg';
                    trackObj.mp3Url = 'audio/' + trackObj.trackName + '.mp3';
                    trackObj.aacUrl = 'audio/' + trackObj.trackName + '.aac';
                    var trackAlbum = response.data.feed.entry[j].content.$t.substring(7);
                    for (var k = 0; k < albums.length; k++) {
                        if (albums[k].albumName == trackAlbum) {
                            albums[k].tracks.push(trackObj);
                            if (j == response.data.feed.entry.length - 1) {
                                audioDeffered.resolve(albums);
                            }
                        }
                    }
                }
            });
    });
    /*$http.get('getAudio').
    then(function(response) {
        audioDeffered.resolve(response.data);
    });*/
    return audioDeffered.promise;
});
app.filter('secondsToDateTime', [function() {
    return function(seconds) {
        return new Date(1970, 0, 1).setSeconds(seconds);
    };
}]);
app.controller('NavController', function($scope, $rootScope, $window) {
    $scope.expanded = false;
    $scope.collapsible = false;
    if (document.documentElement.clientWidth > 767) {
        $scope.collapsible = true;
    }
    angular.element($window).bind('resize', function() {
        if (document.documentElement.clientWidth > 767) {
            $scope.collapsible = true;
        } else {
            $scope.collapsible = false;
        }
        $scope.$apply();
    });
    $scope.expand = function() {
        $scope.expanded = !$scope.expanded;
    };
    $scope.close = function() {
        $scope.expanded = false;
        if ($scope.currentTab != 3) {
            $rootScope.moreDetailsIndex = undefined;
        }
    };
});
app.controller('AudioController', function($scope, $rootScope, audio, $timeout) {
    $scope.audioElm = document.getElementById('audio');
    $scope.audioPlayElm = document.getElementById('audio-player');
    $scope.trackElm = document.getElementById('track');
    $scope.playHeadElm = document.getElementById('play-head');
    $scope.loadAndPlay = function() {
        $scope.audioElm.autoplay = false;
        $scope.audioElm.load();
        $scope.audioElm.oncanplaythrough = function() {
            $scope.audioElm.play();
        };
    };
    $rootScope.currentAudio = {
        album: 0,
        track: 0
    };
    $scope.trackDuration = 0;
    $scope.trackPosition = 0;
    $scope.playBool = false;
    audio.then(function(response) {
        $scope.albums = response;
        angular.element(document).ready(function() {
            if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                $scope.mobileFirstPlay = true;
                $scope.audioElm.autoplay = false;
                $scope.playBool = true;
                $scope.audioElm.load();
            } else {
                $scope.loadAndPlay();
            }
        });
    });
    $rootScope.$watchGroup(['currentAudio.track', 'currentAudio.album'], function(newValue, oldValue) {
        $scope.audioElm.pause();
        $scope.trackDuration = 0;
        $timeout(function() {
            $scope.loadAndPlay();
        }, 250);
    });
    $rootScope.$watch('videoOpen', function(newValue, oldVlue) {
        if (newValue != oldVlue) {
            if ($rootScope.videoOpen && !$scope.playBool) {
                $scope.audioElm.pause();
                $scope.playBoolHolder = true;
            } else if ($scope.playBoolHolder) {
                $timeout(function() {
                    $scope.audioElm.play();
                }, 250);
                $scope.playBoolHolder = false;
            } else {
                $scope.playBoolHolder = false;
            }
        }
    })
    $scope.audioElm.ondurationchange = function() {
        $scope.trackDuration = $scope.audioElm.duration;
        $scope.$apply();
    };
    $scope.audioElm.ontimeupdate = function() {
        $scope.trackPosition = $scope.audioElm.currentTime;
        var trackRatio = $scope.trackPosition / $scope.trackDuration;
        var playHeadPosition = Math.floor(trackRatio * $scope.trackElm.offsetWidth);
        $scope.playHeadStyle = {
            'left': playHeadPosition + 'px'
        };
        $scope.$apply();
    };
    $scope.audioElm.onended = function() {
        $scope.forward();
        $scope.$apply();
    };
    $scope.audioElm.onplay = function() {
        $scope.playBool = false;
        $scope.$apply();
    };
    $scope.audioElm.onpause = function() {
        $scope.playBool = true;
        $scope.$apply();
    };
    $scope.play = function() {
        if ($scope.mobileFirstPlay) {
            $scope.audioElm.play();
            $scope.mobileFirstPlay = false;
        } else {
            if ($scope.playBool) {
                $scope.audioElm.play();
            } else {
                $scope.audioElm.pause();
            }
        }
    };
    $scope.muteBool = true;
    $scope.mute = function() {
        $scope.muteBool = !$scope.muteBool;
        $scope.audioElm.muted = !$scope.muteBool;
    };
    $scope.back = function() {
        if ($rootScope.currentAudio.track > 0) {
            $rootScope.currentAudio.track--;
        } else if ($rootScope.currentAudio.track == 0 && $rootScope.currentAudio.album > 0) {
            $rootScope.currentAudio.album--;
            $rootScope.currentAudio.track = $scope.albums[$rootScope.currentAudio.album].tracks.length - 1;
        }
    };
    $scope.forward = function() {
        if ($rootScope.currentAudio.track < $scope.albums[$rootScope.currentAudio.album].tracks.length - 1) {
            $rootScope.currentAudio.track++;
        } else if ($rootScope.currentAudio.track == $scope.albums[$rootScope.currentAudio.album].tracks.length - 1 && $rootScope.currentAudio.album < $scope.albums.length - 1) {
            $rootScope.currentAudio.album++;
            $rootScope.currentAudio.track = 0;
        }
    };
    $scope.positionChange = function(event) {
        var trackWidth = $scope.trackElm.offsetWidth;
        var changeRatio;
        if (event.offsetX) {
            changeRatio = event.offsetX / trackWidth;
        } else {
            //firefox workaround
            var clickPos = event.pageX;
            var windowWidth = window.innerWidth;
            var trackOffset = $scope.trackElm.offsetLeft;
            var audioPlayerOffset = $scope.audioPlayElm.offsetLeft;
            var totalOffset = trackOffset + audioPlayerOffset;
            changeRatio = (clickPos - totalOffset) / trackWidth;
        }
        $scope.audioElm.currentTime = changeRatio * $scope.audioElm.duration;
    };
    $scope.dragBool = false;
    $scope.playHeadDown = function() {
        $scope.audioElm.pause();
        $scope.dragBool = true;
    };
    $scope.mouseMove = function(event) {
        if ($scope.dragBool) {
            var mouseXPos = Math.max(event.x, event.pageX);
            var trackOffset = $scope.trackElm.offsetLeft;
            var audioPlayerOffset = $scope.audioPlayElm.offsetLeft;
            var totalOffset = trackOffset + audioPlayerOffset;
            var trackWidth = $scope.trackElm.offsetWidth;
            var trackRightExtreme = trackWidth + totalOffset;
            if (mouseXPos < totalOffset) {
                $scope.playHeadStyle = {
                    'left': 0
                };
                $scope.newDragTime = 0;
            } else if (mouseXPos >= totalOffset && mouseXPos <= trackRightExtreme) {
                var changeRatio = (mouseXPos - totalOffset) / trackWidth;
                $scope.playHeadStyle = {
                    'left': (mouseXPos - totalOffset) + 'px'
                };
                $scope.newDragTime = Math.floor(changeRatio * $scope.audioElm.duration);
            } else {
                $scope.playHeadStyle = {
                    'left': trackRightExtreme + 'px'
                };
                $scope.newDragTime = $scope.audioElm.duration;
            }
        }
    };
    $scope.playHeadUp = function() {
        if ($scope.dragBool) {
            $scope.audioElm.currentTime = $scope.newDragTime;
            $scope.audioElm.play();
            $scope.dragBool = false;
        }
    };
});
app.controller('HomeController', function($scope, $rootScope, socialMedia, calendar, $anchorScroll) {
    $rootScope.currentTab = 1;
    $scope.slides = [{
        image: 'img/carousel_img_2.jpg'
    }, {
        image: 'img/carousel_img_3.jpg'
    }, {
        image: 'img/carousel_img_1.jpg'
    }];
    socialMedia.then(function(response) {
        $scope.socialMedia = response;
    });
    $scope.limit = {
        news: 5,
        calendar: 5
    };
    $scope.fiveMoreNumber = {
        news: 5,
        calendar: 5
    };
    $scope.fiveMoreBool = {
        news: true,
        calendar: true
    };
    $scope.fiveMore = function(type, array) {
        if ($scope.limit[type] < array.length) {
            $scope.limit[type] += 5;
        }
        if ($scope.limit[type] > array.length - 5) {
            $scope.fiveMoreNumber[type] = array.length % 5;
        }
        if ($scope.limit[type] >= array.length) {
            $scope.fiveMoreBool[type] = false;
        }
    };
    calendar.then(function(response) {
        $scope.upcomingGigs = response.upcomingGigs;
    });
    $scope.moreDetails = function(index) {
        $rootScope.moreDetailsIndex = index;
        $anchorScroll();
    };
});
app.controller('AboutController', function($scope, $rootScope, biography) {
    $rootScope.currentTab = 2;
    biography.then(function(response) {
        $scope.paragraphs = response;
    });
});
app.controller('CalendarController', function($scope, $rootScope, $sce, $timeout, $document, calendar) {
    $rootScope.currentTab = 3;
    calendar.then(function(response) {
        $scope.calendar = response;
    });
    $scope.staticMapUrl = function(formatted_address) {
        return $sce.trustAsResourceUrl('https://maps.googleapis.com/maps/api/staticmap?' + '&zoom=15&size=450x300&maptype=roadmap&markers=color:red%7C' + escape(formatted_address) + '&key=AIzaSyCXuKx-2qjbzDsvhPd2tqZO7BZmYquBeh8');
    };
    $scope.mapLinkUrl = function(place_details) {
        /*if (place_details.website) {
            return $sce.trustAsResourceUrl('http://www.google.com/maps/place/' + escape(place_details.name) + '+' + escape(place_details.formatted_address) + '/@' + escape(place_details.geometry.location.lat) + ',' + escape(place_details.geometry.location.lng) + ',15z/');
        } else {
            return $sce.trustAsResourceUrl('http://www.google.com/maps/place/' + escape(place_details.formatted_address));
        }*/
        if (place_details.name.substr(0, 10) == place_details.formatted_address.substr(0, 10)) {
            return $sce.trustAsResourceUrl('http://maps.google.com/?q=' + escape(place_details.formatted_address));
        } else {
            return $sce.trustAsResourceUrl('http://maps.google.com/?q=' + escape(place_details.name) + escape(place_details.formatted_address));
        }
    };
    $scope.isOpenUpcomingNumber = undefined;
    if ($rootScope.moreDetailsIndex >= 0) {
        $timeout(function() {
            $scope.isOpenUpcomingNumber = $rootScope.moreDetailsIndex;
            var openElm = angular.element(document.getElementById('calendar-upcoming-' +
                $scope.isOpenUpcomingNumber));
            var navElmHeight = document.getElementById('nav-fixed').offsetHeight;
            $document.duScrollToElement(openElm, navElmHeight, 300);
        }, 300);
    }
    $scope.isOpenPastNumber = undefined;
    $scope.isLinkClicked = false;
    $scope.otherItem = false;
    $scope.linkClicked = function(index, upcoming) {
        $scope.isLinkClicked = true;
        if (upcoming) {
            $scope.isOpenUpcomingNumber = index;
        } else {
            $scope.isOpenPastNumber = index;
        }
    };
    /*$scope.setHash = function(index, upcoming) {
        if (upcoming) {
            $location.hash('calendar-item-upcoming-' + index);
            $scope.indexMousedownObj.upcoming = index;
        } else {
            $location.hash('calendar-item-past-' + index);
            $scope.indexMousedownObj.past = index;
        }
        console.log($scope.indexMousedownObj);
    };*/
    $scope.open = function(index, upcoming) {
        $scope.scrollPosition = document.body.scrollTop;
        $scope.pageHeight = document.body.offsetHeight;
        $scope.scrollRatio = $scope.scrollPosition / $scope.pageHeight;
        if ($scope.isOpenPastNumber) {
            $scope.oldIsOpenPastNumber = $scope.isOpenPastNumber;
        }
        if (upcoming) {
            if ($scope.isLinkClicked == false && $scope.isOpenUpcomingNumber != index) {
                $scope.isOpenUpcomingNumber = index;
            } else if ($scope.isLinkClicked == false && $scope.isOpenUpcomingNumber == index) {
                $scope.isOpenUpcomingNumber = undefined;
            }
            $scope.isOpenPastNumber = undefined;
        } else {
            if ($scope.isLinkClicked == false && $scope.isOpenPastNumber != index) {
                $scope.isOpenPastNumber = index;
                $rootScope.isOpenPastNumber = index;
                if (index > $scope.oldIsOpenPastNumber && $scope.scrollRatio < .75) {
                    $scope.scrollEasing = function(t) {
                        return t * t
                    };
                    $document.scrollTo(0, $scope.scrollPosition - 155, 75, $scope.scrollEasing);
                }
            } else if ($scope.isLinkClicked == false && $scope.isOpenPastNumber == index) {
                $scope.isOpenPastNumber = undefined;
            }
            $scope.isOpenUpcomingNumber = undefined;
        }
        $scope.isLinkClicked = false;
    };
    $scope.close = function() {
        $scope.isOpenPastNumber = undefined;
        $scope.isOpenUpcomingNumber = undefined;
    };
});
app.controller('MusicController', function($scope, $rootScope, audio) {
    $rootScope.currentTab = 4;
    audio.then(function(response) {
        $scope.albums = response;
    });
    $scope.playTrack = function(index, parentIndex) {
        $rootScope.currentAudio.album = parentIndex;
        $rootScope.currentAudio.track = index;
    };
});
app.controller('VideosController', function($scope, $rootScope, videos, $modal) {
    $rootScope.currentTab = 5;
    videos.then(function(response) {
        $scope.videos = response;
    });
    $scope.open = function(index) {
        $rootScope.videoOpen = true;
        var modalInstance = $modal.open({
            animation: true,
            templateUrl: 'modal/video.html',
            controller: 'VideoModalInstanceCtrl',
            size: 'lg',
            resolve: {
                videoIndex: function() {
                    return index;
                }
            }
        });
        modalInstance.result.then(function(response) {});
    };
});
app.controller('VideoModalInstanceCtrl', function($scope, $rootScope, $sce, $modalInstance, videoIndex, videos) {
    videos.then(function(response) {
        $scope.embedUrl = $sce.trustAsResourceUrl('https://www.youtube.com/embed/' + response[videoIndex].id + '?autoplay=1');
        $scope.description = response[videoIndex].videoDescription;
        $scope.close = function() {
            $modalInstance.close();
        };
    });
    $scope.$on('modal.closing', function() {
        $rootScope.videoOpen = false;
    });
});
app.controller('ContactController', function($scope, $rootScope, $http) {
    $rootScope.currentTab = 6;
    $scope.contact = {};
    $scope.submit = function() {
        $http.post('/email', angular.toJson($scope.contact)).
        then(function(response) {
            if (response.data == 'error') {
                console.log(response);
                $scope.contactResponse = 'There was an error. Please try again.';
                $scope.contactErrorBool = true;
            } else {
                $scope.contactResponse = 'Thanks for contacting me.';
                $scope.contactErrorBool = false;
                $scope.contact = {};
            }
        });
    };
});