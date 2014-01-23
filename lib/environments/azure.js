var path = require('path');
exports.config = {
  // either http or https
  protocol: 'https',

  // hostname is important for authentication,
  // if it doesn't match the URL you're serving from,
  // backpack won't work.
  hostname: 'msbackpack.azurewebsites.net',

  // When constructing absolute URLs, this port will be appended to the host
  // This can be different from the internal port if you have a proxy in front
  // of node.
  port: process.env.PORT || 8080,

  // Various files related to cookie management and other things are saved here.
  var_path: path.join(__dirname, '../../var'),

  // Where to cache badge images from the issued badges
  badge_path: path.join(__dirname, '../../static/_badges'),

  // Administrators, users with these accounts can access certain pages
  admins: ['matts@assistx.me'],

  // Database configuration
  // Make sure to create a user that has full privileges to the database
  database: {
    driver: 'mysql',
    host: 'us-cdbr-azure-west-a.cloudapp.net',
    user: 'b11f33452b77fe',
    password: '912bd9d7',
    database: 'msbackpA4CW03Jfe'
  },
  
  //Database=msbackpA4CW03Jfe;Data Source=us-cdbr-azure-west-a.cloudapp.net;User Id=b11f33452b77fe;Password=912bd9d7

  // BrowserID verifier location.
  // You almost certainly shouldn't need to change this.
  identity: {
    protocol: 'https',
    server: 'verifier.login.persona.org',
    path: '/verify'
  },
  
  // Azure ACS Information
  azureacs: {
    path: '/auth/azureacs/callbak',
    realm: 'http://msbackpack.azurewebsites.net/',
    homeRealm: '', // specify an identity provider to avoid showing the idp selector
    identityProviderUrl: 'https://obiissuer.accesscontrol.windows.net/v2/wsfederation',
    thumbprint: 'C4A8FAF020D1FF31D6BF30A76642755B86891FCA',
    signoutReply: 'https://msbackpack.azurewebsites.net/'
  },

  // LESS/CSS compilation settings
  // Additional options: https://github.com/emberfeather/less.js-middleware#options
  // Recommended PRODUCTION settings:
  //   less: {
  //     once: true,
  //     compress: true,
  //     force: false
  //   }
  less: {
    once: false,
    compress: "auto",
    force: true
  },

  // Nunjucks settings
  // More info: http://nunjucks.jlongster.com/api#Using-Nunjucks-in-the-Browser
  // Compilation of templates must be handled externally; see `bin/template-precompile`
  nunjucks_precompiled: false
}
