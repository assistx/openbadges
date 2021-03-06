var passport = require('passport')
var wsfedsaml2 = require('passport-wsfed-saml2').Strategy
var User = require('./models/user');
var Logger = require('./lib/logging').logger;
var azureacsconfig = require('./lib/configuration').get('azureacs');

passport.use(new wsfedsaml2( 
    azureacsconfig,
    function(identity, done) {
        return findOrCreateById(getFedId(identity), function(err, user, info) {
           if (err) {
               done(err, null, info);
           } else {
               done(null, user, info);
           }
        });
    }
));

passport.serializeUser(function(user, done) {
    done(null, { fed_id: user.get('fed_id') });
});

passport.deserializeUser(function(user, done) {
    if (!user) {
        Logger.debug("(Azure ACS) Nothing to see here, nothing to deserialize");
        done(null, null);
    } else if (!user.fed_id) {
        Logger.warn("(Azure ACS) Can't deserialize, no valid fed_id " + require('util').inspect(user));
        done(null, null);
    } else {
        User.findOne( { fed_id: user.fed_id }, function(err, user) {
           if (err) {
                Logger.error("(Azure ACS) Problem getting user from azure session:");
                Logger.error(err);
                done(null, null);
           } 
           
           if (!user) {
               Logger.error("(Azure ACS) Unable to retrieve user using fed_id " + user.fed_id);
               done(null, null);
           } else {
               done(null, user);
           }
        });
    }
});

exports.logOut = function logOut(req, res) {
    var logoutUrl = null;
    if (req.user && req.user.attributes.fed_id)
    {
        logoutUrl = azureacsconfig.identityProviderUrl + "?wa=wsignout1.0&wreply=" + encodeURIComponent(azureacsconfig.signoutReply) + "&wtrealm=" + encodeURIComponent(azureacsconfig.realm);
        console.log("LogoutUrl:", logoutUrl);
    }   
    
    var assertions = null;
    if (req.session && req.session.azureacsassertions)
        assertions = req.session.azureacsassertions;
        
    req.session = {};
    req.logout();
    
    if (assertions)
        req.session.azureacsassertions = assertions;
    
    if (logoutUrl)
        res.redirect(303, logoutUrl);  
    else
        res.redirect(303, '/backpack/login');
};

exports.initAzureACS = function (app) {
    app.use(passport.initialize());
    app.use(passport.session());
    
    app.get('/auth/azureacs',
        passport.authenticate('wsfed-saml2', { failureRedirect: '/', failureFlash: true }),
        function(req, res) {
            res.redirect('/');
    });
    
    app.get('/issuer/frameless', require('./controllers/issuer').frameless);
    
    app.get('/auth/azureacs/callback', function(req, res) {
       // we are probably only going to get here if things like wsignoutcleanup1.0 is called or something 
       // we have already cleaned up, so just return empty
       res.send("wsignoutcleanup1.0 completed");
    });
    
    app.post('/auth/azureacs/callback', function(req, res, next) {
        passport.authenticate('wsfed-saml2', function(err, user, info) {
            if (err) { return res.render('errors/401.html', { csrfToken: req.session._csrf, errorReason: err });  }
            if (info && info.message) { return res.render('errors/401.html', { csrfToken: req.session._csrf, errorReason: info.message });  }
            if (!user) { req.flash('error', 'Unknown Error (could not find or create user)'); return res.render('errors/401.html', { error: req.flash('error'), csrfToken: req.session._csrf, errorReason: err });  }
            req.logIn(user, function(err) {
                if (err) { return res.render('errors/401.html', { csrfToken: req.session._csrf, errorReason: err });  }
                if (strEndsWith(req.user.get('email'), "@no.email")) {
                    Logger.debug("(Azure ACS) Need to register email");
                    res.render('azure-register.html', { error: req.flash('error'), csrfToken: req.session._csrf });
                } else {
                    req.session.emails = [ req.user.get('email') ];
                
                    if (req.session.azureacsassertions) {
                        res.redirect('/issuer/frameless?'+ Date.now());
                    } else if (req.session.backpackConnect) {
                        res.redirect('/access?scope=issue&callback=' + req.session.backpackConnect);  
                    } else {
                        res.redirect('/');
                    }
                }
            });
        })(req, res, next);
    });
    
    app.post('/auth/azureacs/register', function(req, res){
        Logger.debug("(Azure ACS) Registering user's email", req.body.email);
        req.user.set('email', req.body.email);
        req.user.set('active', true);
        req.user.save(function(err) { 
            if (err) { 
                Logger.error("(Azure ACS) Unable to update user:");
                Logger.error(err); 
                req.logout();
                res.redirect('/auth/azureacs');
            } else {
                req.session.emails = [ req.user.get('email') ];
                
                if (req.session.azureacsassertions) {
                    res.redirect('/issuer/frameless?'+ Date.now());
                } else {
                    res.redirect('/');
                }
            }    
        });
    });

    app.get('/auth/azureacs/logout', function(req, res){
        require('./azureacs').logOut(req,res);
    });
    
    app.get('/auth/azureacs/destroy', function(req, res) {
        var email = null;
        var Group = require('./models/group');
        var Portfolio = require('./models/portfolio');
        var Badge = require('./models/badge');
        
        if (req.session && req.session.emails && req.session.emails[0]) {
            email = req.session.emails[0];
        } else if (req.user && req.user.email) {
            email = req.user.email;
        } else if (req.query['email']) {
            email = req.query['email'];
        } else {
            res.send("Error - no account specified, please login");
            res.end();
        }
        
        User.findOne({ email: email }, function (err, user) {
            if (err) { res.send("Error - unable to get user " + err); res.end(); }
            if (!user) { res.send("Error - unable to find user " + err); res.end(); }
            else { 
                Group.find({ user_id: user.attributes.id }, function (err, groups){
                    if (err) { res.send("Error - unable to get groups " + err); res.end(); }
                    if (groups.length > 0) { 
                        var groupCount = 0;		
                        groups.forEach(function(group) {
                            ++groupCount;
                            Portfolio.find({group_id: group.attributes.id}, function(err, portfolios) {
                                if (err) { res.send("Error - unable to get portfolios " + err); res.end(); }  
                                if (portfolios.length > 0) {
                                    var portfolioCount = 0;
                                    portfolios.forEach(function(portfolio) {
                                        ++portfolioCount;
                                        portfolio.destroy(function(err) {
                                            if (err) { res.send("Error - unable to remove portfolio " + err); res.end(); }
                                            if (--portfolioCount === 0) { 
                                                removeGroup(function(err) {
                                                    if (err) { res.send("Error - unable to remove group " + err); res.end(); }
                                                    if (--groupCount === 0) { removeBadges(); }
                                                });
                                            }										
                                        });
                                    });
                                } else {
                                    removeGroup(function(err) {
                                        if (err) { res.send("Error - unable to group " + err); res.end(); }
                                        if (--groupCount === 0) { removeBadges(); }
                                    });
                                }
                            });	
                            
                            function removeGroup(callback) {
                                group.destroy(callback);
                            }
                        });
                    } else {
                        removeBadges();
                    }
                });
            }
            
            function removeBadges() {
                Badge.find({ user_id: user.attributes.id }, function(err, badges) {
                    if (err) { res.send("Error - unable to get badges " + err); res.end(); }  
                    if (badges.length > 0) {
                        var badgeCount = 0;
                        badges.forEach(function(badge) {
                            ++badgeCount;
                            badge.destroy(function(err) {
                                if (err) { res.send("Error - unable to delete badge " + err); res.end(); } 
                                if (--badgeCount === 0) { 
                                     removeUser();
                                } 
                            });
                        });
                    } else {
                        removeUser(); 
                    }
                });
            }
            
            function removeUser(callback) {
                user.destroy(function(err) {
                    if (err) { res.send("Error - unable to remove user " + err); res.end(); }
                    req.logout();
                    req.session.emails = [];
                    res.redirect('/');
                });
            }
        });
    });
};

function findOrCreateById(fedid, callback) {
    if (fedid) {
        User.findOrCreateByFedId(fedid, function (err, user, info) {
            if (err) {
                Logger.error("(Azure ACS) Problem finding/creating user:");
                Logger.error(err);
                return callback(err, null, info);
            } else {
                return callback(null, user, info);
            }
        });  
    } else {
        Logger.debug("(Azure ACS) No fed_id available");
        return callback(null, null);
    }
}

function getFedId(identity) {
    var nameidentifier = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';
    var emailaddress = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress';
    var identityprovider = 'http://schemas.microsoft.com/accesscontrolservice/2010/07/claims/identityprovider';
    
    if (identity.issuer == 'https://obiissuer.accesscontrol.windows.net/') {
        var newId = { 'federated_id': identity[nameidentifier], 'email': identity[emailaddress], 'fed_issuer': identity[identityprovider] };
        //console.log("newId", newId);
        return newId;
    } else {
        return identity;
    }
}

function strEndsWith(str, suffix) {
    return str.match(suffix+"$")==suffix;
}





