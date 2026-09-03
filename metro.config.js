const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('mjs');

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
