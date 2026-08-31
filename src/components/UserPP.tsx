import { View, StyleSheet } from 'react-native';
import ProfileImage from './ProfileImage';

interface UserPPProps {
  image?: string;
  isActive?: boolean;
  size?: number;
  hasStory?: boolean;
}

const UserPP = ({ image, isActive = false, size = 40, hasStory = false }: UserPPProps) => {
  const avatarSize = size;
  const ringWidth = hasStory ? 3.5 : 0;
  const outerSize = avatarSize + ringWidth * 2;

  return (
    <View style={{ width: outerSize, height: outerSize }}>
      <View
        style={[
          styles.ring,
          {
            width: outerSize,
            height: outerSize,
            borderRadius: outerSize / 2,
            borderWidth: ringWidth,
            borderColor: hasStory ? '#5D93EB' : 'transparent',
          },
        ]}
      >
        <ProfileImage
          uri={image}
          pixelSize={Math.round(avatarSize * 2)}
          style={[
            styles.image,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
            },
          ]}
        />
      </View>
      {isActive && (
        <View
          style={[
            styles.activeDotContainer,
            {
              width: Math.max(10, avatarSize * 0.22),
              height: Math.max(10, avatarSize * 0.22),
              borderRadius: Math.max(5, avatarSize * 0.11),
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  activeDotContainer: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    backgroundColor: '#00C851',
    borderWidth: 1.5,
    borderColor: '#1E1F20',
  },
});

export default UserPP;
