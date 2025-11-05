module.exports = {
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




