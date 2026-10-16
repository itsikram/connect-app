const preset = require('@react-native/jest-preset');

module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '\.(png|jpe?g|gif|webp|mp3|wav|mp4|ttf|otf)$': '<rootDir>/__mocks__/fileMock.js',
  },
  // The Ludo tests run the real game server (../server, plain Node code) in
  // process; it must not go through the app's Babel preset.
  transformIgnorePatterns: [...preset.transformIgnorePatterns, '[\\\\/]server[\\\\/]'],
};
