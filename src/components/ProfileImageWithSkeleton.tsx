import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import ProfileImage from './ProfileImage';
import ImageWithSkeleton from './ImageWithSkeleton';
import { getProfileImageSource } from '../lib/profileImage';

type Props = {
  uri?: string | null;
  pixelSize?: number;
  style?: any;
};

const ProfileImageWithSkeleton = ({ uri, pixelSize, style }: Props) => {
  const source = getProfileImageSource(uri || '', pixelSize);
  if (!source) return <ProfileImage uri={uri} pixelSize={pixelSize} style={style} />;
  return <ImageWithSkeleton source={source} style={style} />;
};

export default ProfileImageWithSkeleton;
