import React, { useCallback } from 'react';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import LudoGameSVG from './LudoGameSVG';
import { useLudoGame } from '../contexts/LudoGameContext';

/**
 * Ludo in the Menu stack. Route params:
 *   gameId        the game on screen; without it this is the Ludo menu
 *   acceptInvite  opened from an invite: take the seat ({ slotIndex? })
 * Each game is its own screen (`push`), so Back returns to the Ludo menu.
 */
const LudoGameScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { setLudoGameActive } = useLudoGame();
  const gameId: string | null = route.params?.gameId || null;
  const acceptInvite = route.params?.acceptInvite || null;

  // Full screen while Ludo is focused: the tab bar hides.
  useFocusEffect(
    useCallback(() => {
      setLudoGameActive(true);
      return () => setLudoGameActive(false);
    }, [setLudoGameActive]),
  );

  const onOpenGame = useCallback(
    (id: string, options: { acceptInvite?: { slotIndex?: number }; replace?: boolean } = {}) => {
      const params = { gameId: id, acceptInvite: options.acceptInvite || null };
      if (options.replace) navigation.replace('LudoGame', params);
      else navigation.push('LudoGame', params);
    },
    [navigation],
  );

  const onShowMenu = useCallback(() => {
    const state = navigation.getState?.();
    const previous = state?.routes?.[state.index - 1];
    if (previous?.name === 'LudoGame' && !previous.params?.gameId) {
      navigation.goBack();
      return;
    }
    navigation.replace('LudoGame', { gameId: null });
  }, [navigation]);

  const onExit = useCallback(() => {
    if (navigation.canGoBack?.()) navigation.popToTop();
    else navigation.navigate('MenuHome');
  }, [navigation]);

  return (
    <LudoGameSVG
      gameId={gameId}
      acceptInvite={acceptInvite}
      onOpenGame={onOpenGame}
      onShowMenu={onShowMenu}
      onExit={onExit}
    />
  );
};

export default LudoGameScreen;
