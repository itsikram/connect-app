import * as React from 'react';
import { View } from 'react-native';
import { Portal, Dialog, Button, Text, ProgressBar } from 'react-native-paper';
import type { UpdatePhase } from '../hooks/useAutoUpdate';

type UpdateModalProps = {
  visible: boolean;
  phase: UpdatePhase;
  serverVersion?: string;
  progress: number;
  error?: string;
  onDismiss: () => void;
  onAllow: () => void;
  onRetry: () => void;
  onUpdate: () => void;
};

export default function UpdateModal({
  visible,
  phase,
  serverVersion,
  progress,
  error,
  onDismiss,
  onAllow,
  onRetry,
  onUpdate,
}: UpdateModalProps) {
  const versionLabel = serverVersion ? ` ${serverVersion}` : '';

  let title = 'Updating Connect';
  let body: React.ReactNode = null;
  let actions: React.ReactNode = <Button onPress={onDismiss}>Hide</Button>;

  if (phase === 'available') {
    title = 'Update available';
    body = (
      <Text>
        Connect{versionLabel} is available. Update now? You can turn on
        automatic updates in Menu → About Connect.
      </Text>
    );
    actions = (
      <>
        <Button onPress={onDismiss}>Later</Button>
        <Button mode="contained" onPress={onUpdate}>
          Update
        </Button>
      </>
    );
  } else if (phase === 'permission') {
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
    body = (
      <View style={{ gap: 8 }}>
        <Text>Could not update to version{versionLabel}.</Text>
        {error ? (
          <Text variant="bodySmall" style={{ opacity: 0.8 }}>
            {error}
          </Text>
        ) : null}
      </View>
    );
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
