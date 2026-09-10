import React from 'react';
import { StyleSheet, Text, View, TextStyle, ViewStyle } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { colors } from '../theme/colors';

type VerifiedNameProps = {
  name: string;
  verified?: boolean;
  textStyle?: TextStyle | TextStyle[];
  style?: ViewStyle | ViewStyle[];
  numberOfLines?: number;
};

const VerifiedName = ({
  name,
  verified = false,
  textStyle,
  style,
  numberOfLines,
}: VerifiedNameProps) => (
  <View style={[styles.row, style]}>
    <Text style={textStyle} numberOfLines={numberOfLines}>
      {name}
    </Text>
    {verified ? (
      <Icon
        name="verified"
        size={17}
        color={colors.primary}
        accessibilityLabel="Verified profile"
        accessibilityRole="image"
        style={styles.icon}
      />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  icon: {
    marginLeft: 6,
  },
});

export default VerifiedName;
