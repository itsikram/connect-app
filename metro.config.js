const { getDefaultConfig } = require('expo/metro-config');

/**
 * Metro configuration for Expo
 * https://docs.expo.dev/build-reference/metro/
 *
 * @type {import('expo/metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname);

// Add SVG transformer support
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...(config.resolver.extraNodeModules || {}),
    'react-native-vector-icons': require.resolve('@expo/vector-icons'),
  },
  assetExts: [...new Set([...config.resolver.assetExts.filter((ext) => ext !== 'svg'), 'wav', 'mp3'])],
  sourceExts: [...new Set([...(config.resolver.sourceExts || []), 'ts', 'tsx', 'js', 'jsx', 'svg'])],
};

module.exports = config;
