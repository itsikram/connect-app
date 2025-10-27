import React from 'react';
import { View, StyleSheet } from 'react-native';
import FaceMeshCameraDemo from '../components/FaceMeshCameraDemo';

const EmotionFaceMeshDemo: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* detectionIntervalMs=0 enables continuous streaming updates via RAF */}
      <FaceMeshCameraDemo detectionIntervalMs={0} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 16,
  },
});

export default EmotionFaceMeshDemo;



