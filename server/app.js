/* TODO: Manage passcodes in a better way and/or add a *real* login/password/authentication layer
 *       (They're not guaranteed to be unique, it's easy to brute force one's way into someone's diary)
 *       Improve security of admin pages.
 */

var config = require('../config.js');

/* APP REQUIREMENTS */
var express = require('express');
var basicAuth = require('basic-auth');
var bodyParser = require('body-parser');
var redirect = require('express-redirect');
var monk = require('monk');
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var gulp = require('gulp');
var imageResize = require('gulp-image-resize');
var passhash = require('password-hash');

var app = express();
var db = monk(config.db_connection);
var collection = db.get(config.db_collection);
var config_collection = db.get(config.db_collection + '_config');
var destpath = path.resolve(__dirname, '../www/images');
var upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, destpath);
        },
        filename: function (req, file, cb) {
            var ext = ({'image/jpeg':'.jpg', 'image/png':'.png', 'image/gif':'.gif'})[file.mimetype];
            cb(null, req.body._id + ext);
        }
    })
});
var jsonParser = bodyParser.json();

redirect(app);

collection.index('user_code');

app.locals.moment = require('moment');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(express.static(path.resolve(__dirname, '../www')));

/* Config endpoint */

app.get('/config', function(req, res) {
    var restxt = 'window.DIARY_CONFIG = '
        + JSON.stringify(config.client_config)
        + ';';
    res.setHeader('Content-type','text/javascript');
    res.send(restxt);
});

/* ENDPOINTS CALLED FROM STATIC MAIN VIEW */

app.post('/media-uploader', upload.single('image'), function(req, res) {
    gulp.src(req.file.path)
        .pipe(imageResize({
            width: 400,
            height: 400,
            quality: .7,
            upscale: false,
            imageMagick: config.use_image_magick,
        }))
        .pipe(gulp.dest(path.resolve(__dirname, '../www/images/min/')))
        .pipe(imageResize({
            width: 48,
            height: 48,
            quality: .5,
            crop: true,
            upscale: false,
            imageMagick: config.use_image_magick,
        }))
        .pipe(gulp.dest(path.resolve(__dirname, '../www/images/thumbnails/')))
        .on('end', function() {
            res.json({
                image: 'images/min/' + req.file.filename,
                thumbnail: 'images/thumbnails/' + req.file.filename
            });
        });
});

app.post('/login', jsonParser, function(req, res) {
    var user_code = req.body.user_code;
    collection.find({
        'user_code': user_code
    }, function(err, user_entries) {
        if (err) {
            res.status(500).send({error: err});
        } else {
            res.json({
                'authenticated': true,
                'diary_entries': user_entries
            });
        }
    });
});

app.post('/entry', jsonParser, function(req, res) {
    var data = req.body,
        id = data._id;
        
        collection.findById(id,function(err, doc) {
            if (err) {
                res.status(500).send({error: err});
            } else {
                if (doc) {
                    collection.updateById(id, data, function(err, doc) {
                        if (err) {
                            res.status(500).send({error: err});
                        } else {
                            res.json({
                                '_id': id,
                                'status': 'updated'
                            });
                        }
                    });
                } else {
                    collection.insert(data, function(err, doc) {
                        if (err) {
                            res.status(500).send({error: err});
                        } else {
                            res.json({
                                '_id': id,
                                'status': 'inserted'
                            });
                        }
                    });
                }
            }
        });
 
});

app.delete('/entry/:id([0-9a-f\-]+)', function(req, res) {
    var id = req.params.id;
    collection.remove({_id: id}, function(err, doc) {
        if (err) {
            res.status(500).send({error: err});
        } else {
            res.json({
                '_id': id,
                'status': (doc ? 'removed' : 'never existed')
            });
        }
    });
});

/* ADMIN PAGES */

var adminAuth = function (req, res, next) {
    config_collection.findOne({
        key: 'admin_credentials'
    }, function(err, admin_credentials) {
        if (!admin_credentials) {
            return res.status(401).send('An admin password should be configured. See README.md for more information');
        } else {
            var user = basicAuth(req);
            if (user && user.name === admin_credentials.username && passhash.verify(user.pass, admin_credentials.password)) {
                return next();
            } else {
                res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
                return res.sendStatus(401);
            };
        }
    });
};

app.redirect('/admin$', 'admin/all/');
app.redirect('/admin/$', 'all/');

app.redirect('/admin/all$', 'all/');
app.get('/admin/all/$', adminAuth, function(req, res) {
    res.render('adminlist', {
        title:'Admin pages',
        config: config.client_config
    });
});

app.get('/admin/dump-data/$', adminAuth, function(req, res) {
    collection.find(
        {},
        {
            sort: {
                user_code: 1
            }
        }, function(err, user_entries) {
        if (err) {
            res.status(500).send({error: err});
        } else {
            res.setHeader('Content-disposition','attachment; filename="diaries.json"');
            res.json(user_entries);
        }
    });
});

function generateUniquePasscode(callback) {
    var genstr = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    var idlen = 6;
    var generated_id = Array.prototype.constructor.apply(Array,Array(idlen)).map( function(){
        return genstr[Math.floor(Math.random()*genstr.length)];
    }).join('');
    collection.find({
        'user_code': generated_id
    }, function(err, user_entries) {
        if (user_entries && user_entries.length) {
            generateUniquePasscode(callback);
        } else {
            callback(generated_id);
        }
    });
}

app.redirect('/admin/id-generator$', 'id-generator/');
app.get('/admin/id-generator/$', adminAuth, function(req, res) {
    var tbl = [],
        idcount = 10;
    
    function addId() {
        generateUniquePasscode(function(passcode) {
            tbl.push(passcode);
            if (tbl.length < idcount) {
                addId();
            } else {
                res.render('idgen', {
                    title: 'ID Generator',
                    ids: tbl,
                    config: config.client_config
                });
            }
        });
    }
    addId();
});

app.get('/passcode', function(req, res) {
    generateUniquePasscode(function(passcode) {
        res.send(passcode);
    });
});

app.redirect('/admin/active-users$', 'active-users/');
app.get('/admin/active-users/$', adminAuth, function(req, res) {
    collection.find({}, 'user_code modified_date', function(err, entries) {
        var user_counts = {}, user_dates = {};
        entries.forEach(function(entry) {
            user_counts[entry.user_code] = (1 + (user_counts[entry.user_code] || 0));
            user_dates[entry.user_code] = Math.max(Date.parse(entry.modified_date), (user_dates[entry.user_code] || 0));
        });
        var users = [];
        for (k in user_counts) {
            users.push({
                user_code: k,
                entry_count: user_counts[k],
                last_active: user_dates[k]
            });
        }
        res.render('userlist', {
            title: 'Active Users',
            users: users,
            config: config.client_config
        });
    });
});

app.redirect('/admin/popular-questions$', 'popular-questions/');
app.get('/admin/popular-questions/$', adminAuth, function(req, res) {
    collection.find({}, 'user_code question', function(err, entries) {
        var question_counts = {}, question_users = {};
        entries.forEach(function(entry) {
            if (!entry.question) {
                return;
            }
            var qtitle = entry.question;
            question_counts[qtitle] = (1 + (question_counts[qtitle] || 0));
            question_users[qtitle] = (question_users[qtitle] || []);
            if (question_users[qtitle].indexOf(entry.user_code) === -1) {
                question_users[qtitle].push(entry.user_code);
            }
        });
        var questions = [];
        for (k in question_counts) {
            questions.push({
                question_title: k,
                entry_count: question_counts[k],
                user_count: question_users[k].length
            });
        }
        questions.sort(function(a,b) {
            return b.entry_count - a.entry_count;
        });
        res.render('questionlist', {
            title: 'Popular questions',
            questions: questions,
            config: config.client_config
        });
    });
});

module.exports = app;
