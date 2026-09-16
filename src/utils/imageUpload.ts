import * as ImagePicker from 'expo-image-picker';

export const compatibleImagePickerOptions = {
  preferredAssetRepresentationMode:
    ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

type ImageAssetLike = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  [key: string]: unknown;
};

export const normalizeImageAsset = <T extends ImageAssetLike>(asset: T): T => {
  const isPng =
    asset.mimeType?.toLowerCase() === 'image/png' ||
    /\.png$/i.test(asset.fileName || '');
  const extension = isPng ? 'png' : 'jpg';
  const mimeType = isPng ? 'image/png' : 'image/jpeg';
  const baseName = (asset.fileName || 'upload').replace(/\.[^.]+$/, '');
  const fileName = `${baseName}.${extension}`;

  return {
    ...asset,
    fileName,
    mimeType,
  };
};
