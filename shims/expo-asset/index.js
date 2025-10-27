// Minimal shim for 'expo-asset' to support @tensorflow/tfjs-react-native in bare RN apps.
// Provides Asset.fromModule(moduleId) returning an object with { uri, type }.
const { Image } = require('react-native');

function getTypeFromUri(uri) {
  const match = typeof uri === 'string' ? uri.match(/\.([a-zA-Z0-9]+)$/) : null;
  return match ? match[1] : '';
}

const Asset = {
  fromModule(moduleId) {
    try {
      const src = Image.resolveAssetSource(moduleId);
      if (src && src.uri) {
        return { uri: src.uri, type: getTypeFromUri(src.uri) };
      }
    } catch (e) {
      // fall through
    }
    if (typeof moduleId === 'string') {
      return { uri: moduleId, type: getTypeFromUri(moduleId) };
    }
    return { uri: String(moduleId), type: '' };
  },
};

module.exports = { Asset };


