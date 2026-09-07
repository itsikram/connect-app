import React from 'react';
import { StyleSheet, Text, View, TextStyle, ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

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
        name="check-circle"
        size={15}
        color="#16a34a"
        accessibilityLabel="Verified profile"
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
    marginLeft: 5,
  },
});

export default VerifiedName;
