const fs = require('fs');

// app.json stays the main config. This only adds Android push (FCM) when the
// Firebase file exists: from the GOOGLE_SERVICES_JSON file variable on EAS, or
// a google-services.json in the project root.
module.exports = ({ config }) => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ??
    (fs.existsSync(`${__dirname}/google-services.json`) ? './google-services.json' : undefined);

  return googleServicesFile ? { ...config, android: { ...config.android, googleServicesFile } } : config;
};
