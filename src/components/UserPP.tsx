import { View, Text, StyleSheet, Image } from 'react-native';
import config from '../lib/config';
const UserPP = ({ image, isActive, size }: { image: string, isActive: boolean, size?: number }) => {
  return (
    <View>
      <Image source={{ uri: image || config?.DEFAULT_PROFILE_URL  }} style={[styles.image, { width: size || 40, height: size || 40, borderRadius: (size || 40) / 2 }]} />
      {isActive && <View style={styles.activeDotContainer} />}
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    width:  40,
    height: 40,
    borderRadius: 20,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'green',
  },
  activeDotContainer: {
    position: 'absolute',
    bottom: 1.5,
    right: 1.5,
    backgroundColor: 'green',
    borderRadius: 5,
    padding: 4,
  },
});

export default UserPP;