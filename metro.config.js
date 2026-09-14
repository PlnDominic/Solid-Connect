const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('mjs');

// admin/ (Next.js) and api/ (NestJS) are separate projects living in this
// same repo, each with their own package.json/node_modules/build output -
// nothing in the Expo app ever imports from them. Metro's default watcher
// covers the whole project root regardless, so without this it also
// watches admin/.next and admin|api/node_modules: Next's dev server
// creates/deletes files under .next constantly, and once raced Metro's
// watcher into trying to watch a directory that had just been removed,
// crashing the whole Expo/Metro process with an ENOENT. Anchored to the
// project root (not a bare /admin/|/api/ match) so this can't also catch
// the mobile app's own src/api/ folder, which is a different, legitimate
// directory with the same trailing name.
const escapeForRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rootAdminPath = escapeForRegExp(path.join(__dirname, 'admin'));
const rootApiPath = escapeForRegExp(path.join(__dirname, 'api'));
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : [config.resolver.blockList].filter(Boolean)),
  new RegExp(`^${rootAdminPath}[\\\\/].*`),
  new RegExp(`^${rootApiPath}[\\\\/].*`),
];

const LUCIDE_BASE = path.join(__dirname, 'node_modules/lucide-react-native');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'lucide-react-native') {
    return {
      filePath: path.join(LUCIDE_BASE, 'dist/cjs/lucide-react-native.js'),
      type: 'sourceFile',
    };
  }

  if (moduleName.startsWith('lucide-react-native/')) {
    const subpath = moduleName.replace('lucide-react-native/', '');
    return {
      filePath: path.join(LUCIDE_BASE, 'dist/cjs/icons', subpath + '.js'),
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
