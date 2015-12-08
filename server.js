var express = require('express');
var http = require('http');
var https = require('https');
var bodyParser = require('body-parser');
var nodemailer = require('nodemailer');
var mg = require('nodemailer-mailgun-transport');
var codebird = require('codebird');
var q = require('q');
var fs = require('fs');
var schedule = require('node-schedule');
var app = express();
var cb = new codebird;
var auth = {
    auth: {
        api_key: '[KEY]',
        domain: 'austinbyrd.com'
    }
};
var nodemailerMailgun = nodemailer.createTransport(mg(auth));

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080;
var ip = process.env.IP || process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static(__dirname + '/public'));

app.get('/getCalendar', function(req, res) {
    res.sendFile(__dirname + '/json/calendarStorage.json');
});
app.get('/getVideos', function(req, res) {
    res.sendFile(__dirname + '/json/videos.json');
});
app.get('/getAudio', function(req, res) {
    res.sendFile(__dirname + '/json/audio.json');
});
var facebookAccessToken = '[ACCESSTOKEN]';
var facebookUrl = 'https://graph.facebook.com/v2.5/austinbyrdjazz?access_token=' + facebookAccessToken + '&fields=feed{type,message,picture,event,created_time,object_id,actions,name,description}';
app.get('/facebook', function(req, resInternal) {
    var facebookData = {};
    var facebookPhotoArray = [];
    q.fcall(function() {
        var facebookDeferred = q.defer();
        https.get(facebookUrl, function(resExternal) {
            var data = '';
            resExternal.on('data', function(d) {
                data += d;
            });
            resExternal.on('end', function() {
                facebookDeferred.resolve(data);
            });
        }).on('error', function(err) {
            console.log('got error ' + err.message);
        });
        return facebookDeferred.promise;
    }).then(function(data) {
        var facebookWithoutImgsDeferred = q.defer();
        facebookFeed = JSON.parse(data);
        facebookData = facebookFeed.feed.data;
        for (var i = 0; i < facebookData.length; i++) {
            if (facebookData[i].type == 'photo' && facebookData[i].picture) {
                var facebookPhotoUrl = 'https://graph.facebook.com/v2.5/' + facebookData[i].object_id + '?access_token=' + facebookAccessToken + '&fields=images';
                var photoObj = {
                    url: facebookPhotoUrl,
                    index: i
                };
                facebookPhotoArray.push(photoObj);
            } else if (facebookData[i].type == 'event' && facebookData[i].picture) {
                facebookData[i].picture = 'https://graph.facebook.com/' + facebookData[i].object_id + '/picture?type=large';
            }
        }
        facebookWithoutImgsDeferred.resolve(facebookData);
        return facebookWithoutImgsDeferred.promise;
    }).then(function(data) {
        var facebookImgDeferred = q.defer();
        var facebookDataToAddImgs = data;
        var getPhotos = function(photoObj, photoCount) {
            https.get(photoObj.url, function(resPhoto) {
                var data = '';
                resPhoto.on('data', function(d) {
                    data += d;
                });
                resPhoto.on('end', function() {
                    var photoData = JSON.parse(data);
                    facebookDataToAddImgs[photoObj.index].picture = photoData.images[0].source;
                    if (photoCount.count == facebookPhotoArray.length) {
                        facebookImgDeferred.resolve(facebookDataToAddImgs);
                    }
                    photoCount.count++;
                });
            }).on('error', function(err) {
                console.log('got error ' + err.message);
            });
        };
        var photoCount = {
            count: 1
        };
        for (var i = 0; i < facebookPhotoArray.length; i++) {
            getPhotos(facebookPhotoArray[i], photoCount);
        }
        return facebookImgDeferred.promise;
    }).then(function(facebookDataWithImages) {
        resInternal.send(facebookDataWithImages);
    });
});
cb.setConsumerKey('[KEY]', '[SECRET]');
cb.setToken('[TOKEN]', '[TOKENSECRET]');
var cbParams = {
    'count': '400',
    'screen_name': 'austinbyrdjazz',
    'exclude_replies': 'true',
    'include_rts': 'false'
};
app.get('/twitter', function(req, resInternal) {
    cb.__call('statuses_userTimeline', cbParams,
        function(reply) {
            resInternal.send(reply);
        });
});
app.get('*', function(req, res) {
    res.sendfile('public/index.html');
});

var getCalendar = function() {
    var calendarApiKey = '[APIKEY]';
    var calendarUrl = 'https://www.googleapis.com/calendar/v3/calendars/354hj5p1nkt1lb2abj4kc5ba24%40group.calendar.google.com/events?key=' + calendarApiKey;
    q.fcall(function() {
        var calendarStorageDeferred = q.defer();
        fs.readFile('./json/calendarStorage.json', 'utf8', function(err, data) {
            if (err) throw err;
            var calendarStorageData = JSON.parse(data);
            calendarStorageDeferred.resolve(calendarStorageData);
        });
        return calendarStorageDeferred.promise;
    }).then(function(calendarStorageData) {
        var calendarApiDeferred = q.defer();
        https.get(calendarUrl, function(res) {
            var data = '';
            res.on('data', function(d) {
                data += d;
            });
            res.on('end', function() {
                var calendarApiData = JSON.parse(data);
                if (calendarStorageData.updated == calendarApiData.updated) {
                    console.log('same');
                } else {
                    console.log('different');
                    calendarApiDeferred.resolve(calendarApiData);
                }
            });
        });
        return calendarApiDeferred.promise;
    }).then(function(calendarApiData) {
        var instanceDeferred = q.defer();
        var instanceArray = [];
        for (var i = calendarApiData.items.length - 1; i >= 0; i--) {
            if (!calendarApiData.items[i].location) {
                calendarApiData.items.splice(i, 1);
            }
            if (calendarApiData.items[i].recurrence) {
                instanceArray.push(calendarApiData.items[i].id);
                calendarApiData.items.splice(i, 1);
            }
        }
        var instanceCount = 1;
        for (var j = 0; j < instanceArray.length; j++) {
            var instanceUrl = 'https://www.googleapis.com/calendar/v3/calendars/354hj5p1nkt1lb2abj4kc5ba24%40group.calendar.google.com/events/' + instanceArray[j] + '/instances?key=' + calendarApiKey;
            https.get(instanceUrl, function(instanceRes) {
                var data = '';
                instanceRes.on('data', function(d) {
                    data += d;
                });
                instanceRes.on('end', function() {
                    var instanceData = JSON.parse(data);
                    calendarApiData.items = calendarApiData.items.concat(instanceData.items);
                    if (instanceCount == instanceArray.length) {
                        instanceDeferred.resolve(calendarApiData);
                    }
                    instanceCount++;
                });
            });
        }
        return instanceDeferred.promise;
    }).then(function(calendarApiData) {
        var calendarPlaceSearchDeferred = q.defer();
        var placeSearchCount = {
            count: 1
        };
        var placeSearch = function(location, index, count) {
            var placeSearchUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json?query=' + encodeURI(location) + '&key=' + calendarApiKey;
            https.get(placeSearchUrl, function(placeRes) {
                var data = '';
                placeRes.on('data', function(d) {
                    data += d;
                });
                placeRes.on('end', function() {
                    var placeData = JSON.parse(data);
                    calendarApiData.items[index].place_id = placeData.results[0].place_id;
                    if (placeSearchCount.count == calendarApiData.items.length) {
                        calendarPlaceSearchDeferred.resolve(calendarApiData);
                    }
                    placeSearchCount.count++;
                });
            });
        }
        for (var j = 0; j < calendarApiData.items.length; j++) {
            placeSearch(calendarApiData.items[j].location, j, placeSearchCount);
        }
        return calendarPlaceSearchDeferred.promise;
    }).then(function(calendarDataWithPlaceId) {
        var calendarDataWithPlaceIdDeferred = q.defer();
        var placeDetailsCount = {
            count: 1
        };
        var addressBreakdownFunc = function(address_components) {
            var address_breakdown = {};
            for (var j = 0; j < address_components.length; j++) {
                for (var k = 0; k < address_components[j].types.length; k++) {
                    if (address_components[j].types[k] == 'street_number') {
                        address_breakdown.street_number = address_components[j].long_name;
                    } else if (address_components[j].types[k] == 'route') {
                        address_breakdown.street = address_components[j].short_name;
                    } else if (address_components[j].types[k] == 'locality') {
                        address_breakdown.city = address_components[j].long_name;
                    } else if (address_components[j].types[k] == 'administrative_area_level_1') {
                        address_breakdown.state = address_components[j].short_name;
                    } else if (address_components[j].types[k] == 'postal_code') {
                        address_breakdown.zip = address_components[j].long_name;
                    }
                }
            }
            return address_breakdown;
        };
        var placeDetailsSeach = function(place_id, index, count) {
            var placeDetailsUrl = 'https://maps.googleapis.com/maps/api/place/details/json?placeid=' + place_id + '&key=' + calendarApiKey;
            https.get(placeDetailsUrl, function(detailsRes) {
                var data = '';
                detailsRes.on('data', function(d) {
                    data += d;
                });
                detailsRes.on('end', function() {
                    var detailsData = JSON.parse(data);
                    calendarDataWithPlaceId.items[index].place_details = detailsData.result;
                    calendarDataWithPlaceId.items[index].address_breakdown = addressBreakdownFunc(detailsData.result.address_components)
                    if (placeDetailsCount.count == calendarDataWithPlaceId.items.length) {
                        calendarDataWithPlaceIdDeferred.resolve(calendarDataWithPlaceId);
                    }
                    placeDetailsCount.count++;
                });
            });
        };
        for (var i = 0; i < calendarDataWithPlaceId.items.length; i++) {
            placeDetailsSeach(calendarDataWithPlaceId.items[i].place_id, i, placeDetailsCount);
        }
        return calendarDataWithPlaceIdDeferred.promise;
    }).then(function(data) {
        jsonData = JSON.stringify(data);
        fs.writeFile('./json/calendarStorage.json', jsonData, 'utf8', function(err, data) {
            if (err) throw err;
            console.log('saved');
        });
    });
};
var calendarSchedule = schedule.scheduleJob('* 4,10,16,22 * * *', function() {
    getCalendar();
});
getCalendar();
app.post('/email', function(req, res) {
    nodemailerMailgun.sendMail({
        from: req.body.email,
        to: 'austinbyrdmusic@gmail.com',
        subject: 'AustinByrd.com - ' + req.body.subject,
        text: req.body.message
    }, function(err, info) {
        if (err) {
            res.send(err);
            console.log('Error: ' + err);
        } else {
            res.send('Email Sent');
            console.log('Response: ' + info);
        }
    });
});

app.listen(port, ip);
console.log('Server running on ' + ip + ':' + port);