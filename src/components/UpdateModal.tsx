import * as React from 'react';
import { Linking, Platform, View } from 'react-native';
import { Portal, Dialog, Button, Text, useTheme } from 'react-native-paper';

type UpdateModalProps = {
  visible: boolean;
  serverVersion?: string;
  onDismiss: () => void;
  onDownload: () => void;
  apkUrl?: string;
};

export default function UpdateModal({ visible, serverVersion, onDismiss, onDownload, apkUrl }: UpdateModalProps) {
  const theme = useTheme();

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={{ borderRadius: 12 }}>
        <Dialog.Title>Update available</Dialog.Title>
        <Dialog.Content>
          <View style={{ gap: 8 }}>
            <Text>
              A new version{serverVersion ? ` (${serverVersion})` : ''} of the app is available.
            </Text>
            {Platform.OS === 'android' && !!apkUrl && (
              <Text variant="bodySmall" style={{ opacity: 0.7 }}>
                The update will download from the server APK link.
              </Text>
            )}
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Later</Button>
          <Button mode="contained" onPress={onDownload}>
            Download
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}


