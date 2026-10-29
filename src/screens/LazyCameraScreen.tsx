import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

/**
 * The camera screen draws its photo filters with Skia, a native library.
 * Importing it from App.tsx loaded Skia while the app was starting, so any
 * problem with Skia on a phone closed the whole app on launch. It now loads
 * the first time the camera is opened, and if it cannot load, only the
 * camera shows a message instead of the app closing.
 */

let CameraScreen: React.ComponentType<any> | null = null;

function CameraUnavailable() {
  const navigation = useNavigation();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Camera is not available</Text>
      <Text style={styles.body}>
        The camera could not be opened on this phone. Please update the app and try again.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => (navigation.canGoBack() ? navigation.goBack() : undefined)}
      >
        <Text style={styles.buttonText}>Go back</Text>
      </TouchableOpacity>
    </View>
  );
}

export function getCameraScreen(): React.ComponentType<any> {
  if (CameraScreen) return CameraScreen;
  try {
    CameraScreen = require('./CameraScreen').default;
  } catch (error) {
    console.warn('Camera screen failed to load:', error);
    return CameraUnavailable;
  }
  return CameraScreen || CameraUnavailable;
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#000',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  body: { color: '#ccc', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#29B1A9',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
