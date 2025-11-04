const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const base = getDefaultConfig(__dirname);

const config = {
  transformer: {
    ...base.transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    ...base.resolver,
    assetExts: base.resolver.assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...base.resolver.sourceExts, 'svg'],
    extraNodeModules: {
      'expo-asset': require('path').resolve(__dirname, 'shims/expo-asset'),
    },
  },
};

module.exports = mergeConfig(base, config);
