import React, { useEffect, useMemo, useState } from 'react';
import { Image, ImageProps, ImageSourcePropType } from 'react-native';
import {
  DEFAULT_PROFILE_ASSET,
  getProfileImageSource,
  googleImageWebProps,
} from '../lib/profileImage';

type ProfileImageProps = Omit<ImageProps, 'source'> & {
  uri?: string | null;
  pixelSize?: number;
};

const ProfileImage = ({ uri, pixelSize, onError, ...rest }: ProfileImageProps) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const source: ImageSourcePropType = useMemo(() => {
    if (failed || !uri) return DEFAULT_PROFILE_ASSET;
    return getProfileImageSource(uri, pixelSize) || DEFAULT_PROFILE_ASSET;
  }, [failed, uri, pixelSize]);

  return (
    <Image
      source={source}
      defaultSource={DEFAULT_PROFILE_ASSET}
      {...googleImageWebProps}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
      {...rest}
    />
  );
};

export default ProfileImage;
