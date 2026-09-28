const { getDefaultConfig } = require('expo/metro-config');
const { withTunnelBoost } = require('./scripts/expo-control/tunnelBoost');

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

// Compresses bundles for Expo Go over a tunnel; only active when launched by
// the expo-control daemon (EXPO_TUNNEL_BOOST=1).
module.exports = withTunnelBoost(config);
