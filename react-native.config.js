module.exports = {
  project: {
    android: {
      packageName: 'com.connect.app',
    },
    ios: {
      project: './ios/Connect.xcworkspace',
    },
  },
  dependencies: {
    // Disable native autolinking for the original package to avoid duplicate native classes
    'react-native-webview': {
      platforms: {
        android: null,
        ios: null,
        macos: null,
        windows: null,
      },
    },
  },
};










