import * as React from 'react';
import { View } from 'react-native';
import { Portal, Dialog, Button, Text, ProgressBar } from 'react-native-paper';
import type { UpdatePhase } from '../hooks/useAutoUpdate';

type UpdateModalProps = {
  visible: boolean;
  phase: UpdatePhase;
  serverVersion?: string;
  progress: number;
  onDismiss: () => void;
  onAllow: () => void;
  onRetry: () => void;
};

export default function UpdateModal({
  visible,
  phase,
  serverVersion,
  progress,
  onDismiss,
  onAllow,
  onRetry,
}: UpdateModalProps) {
  const versionLabel = serverVersion ? ` ${serverVersion}` : '';

  let title = 'Updating Connect';
  let body: React.ReactNode = null;
  let actions: React.ReactNode = <Button onPress={onDismiss}>Hide</Button>;

  if (phase === 'permission') {
    title = 'Update available';
    body = (
      <Text>
        Connect{versionLabel} is ready. Allow Connect to install apps so it can
        update itself automatically.
      </Text>
    );
    actions = (
      <>
        <Button onPress={onDismiss}>Later</Button>
        <Button mode="contained" onPress={onAllow}>
          Allow
        </Button>
      </>
    );
  } else if (phase === 'downloading') {
    body = (
      <View style={{ gap: 12 }}>
        <Text>
          Downloading version{versionLabel}… {Math.round(progress * 100)}%
        </Text>
        <ProgressBar progress={progress} />
        <Text variant="bodySmall" style={{ opacity: 0.7 }}>
          You can keep using the app while it downloads.
        </Text>
      </View>
    );
  } else if (phase === 'installing') {
    body = (
      <Text>Installing version{versionLabel}. Connect will close to finish updating.</Text>
    );
  } else {
    title = 'Update failed';
    body = <Text>Could not update to version{versionLabel}.</Text>;
    actions = (
      <>
        <Button onPress={onDismiss}>Later</Button>
        <Button mode="contained" onPress={onRetry}>
          Retry
        </Button>
      </>
    );
  }

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={{ borderRadius: 12 }}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>{body}</Dialog.Content>
        <Dialog.Actions>{actions}</Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
