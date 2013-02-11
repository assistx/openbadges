var passport = require('passport')
var wsfedsaml2 = require('passport-wsfed-saml2').Strategy
var User = require('./models/user');
var Logger = require('./lib/logging').logger;
var azureacsconfig = require('./lib/configuration').get('azureacs');

passport.use(new wsfedsaml2( 
    azureacsconfig,
    function(identity, done) {
        return findOrCreateById(getFedId(identity), done);
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

exports.initAzureACS = function (app) {
    app.use(passport.initialize());
    app.use(passport.session());
    
    app.get('/auth/azureacs',
        passport.authenticate('wsfed-saml2', { failureRedirect: '/fail', failureFlash: true }),
        function(req, res) {
            res.redirect('/');
    });
    
    app.get('/issuer/frameless', require('./controllers/issuer').frameless);
    
    app.post('/auth/azureacs/callback',
        passport.authenticate('wsfed-saml2', { failureRedirect: '/fail', failureFlash: true }),
        function(req, res) {
            if (strEndsWith(req.user.get('email'), "@no.email")) {
                Logger.debug("(Azure ACS) Need to register email");
                res.render('azure-register.html', { error: req.flash('error'), csrfToken: req.session._csrf });
            } else {
                req.session.emails = [ req.user.get('email') ];
                
                if (req.session.azureacsassertions) {
                    res.redirect('/issuer/frameless?'+ Date.now());
                } else {
                    res.redirect('/');
                }
            }
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
        req.logout();
        req.session.emails = [];
        
        if (req.session.azureacsassertions)
            res.redirect('/issuer/frameless');
        else
            res.redirect('/');
    });
};

function findOrCreateById(fedid, callback) {
    if (fedid) {
        User.findOrCreateByFedId(fedid, function (err, user) {
            if (err) {
                Logger.error("(Azure ACS) Problem finding/creating user:");
                Logger.error(err);
                return callback(err, null);
            } else {
                return callback(null, user);
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
    
    if (identity.issuer == 'https://obiissuer.accesscontrol.windows.net/') {
        var newId = { 'federated_id': identity[nameidentifier], 'email': identity[emailaddress] };
        //console.log("newId", newId);
        return newId;
    } else {
        return identity;
    }
}

function strEndsWith(str, suffix) {
    return str.match(suffix+"$")==suffix;
}







