import { View, Text, StyleSheet, Image } from 'react-native';

const UserPP = ({ image, isActive, size }: { image: string, isActive: boolean, size?: number }) => {
  return (
    <View>
      <Image source={{ uri: image || 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png'  }} style={[styles.image, { width: size || 40, height: size || 40, borderRadius: size / 2 || 20 }]} />
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