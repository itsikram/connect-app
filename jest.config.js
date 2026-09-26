module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '\.(png|jpe?g|gif|webp|mp3|wav|mp4|ttf|otf)$': '<rootDir>/__mocks__/fileMock.js',
  },
};
