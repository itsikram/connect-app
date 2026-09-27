/* eslint-env jest */
// Module mocks shared by the online Ludo tests. Require this file before
// requiring LudoGameSVG. Everything network-, native- or render-heavy is
// replaced; the game screen, rules and socket sync code are the real ones.
const mockReact = require('react');
const { ClientContext: mockClientContext } = require('./clientContext');

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('react-redux', () => ({
  useSelector: (selector) => {
    const ctx = mockReact.useContext(mockClientContext);
    return selector({ profile: ctx.client.profile });
  },
}));

jest.mock('../../src/contexts/SocketContext', () => ({
  useSocket: () => {
    const ctx = mockReact.useContext(mockClientContext);
    return { emit: ctx.emit, on: ctx.on, off: ctx.off, isConnected: ctx.isConnected };
  },
}));

jest.mock('../../src/contexts/LudoGameContext', () => ({
  useLudoGame: () => {
    const { client } = mockReact.useContext(mockClientContext);
    return {
      isLudoGameActive: client.ludoActive,
      setLudoGameActive: (active) => {
        client.ludoActive = active;
        client.notify();
      },
      pendingLudoInvite: client.pendingLudoInvite,
      requestLudoInvite: (invite) => {
        client.pendingLudoInvite = invite;
        client.notify();
      },
      consumeLudoInvite: () => {
        if (client.pendingLudoInvite) {
          client.pendingLudoInvite = null;
          client.notify();
        }
      },
    };
  },
}));

jest.mock('../../src/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
  },
  connectAPI: { getConnectList: jest.fn(() => Promise.resolve({ data: [] })) },
}));
jest.mock('../../src/lib/config', () => ({ __esModule: true, default: { SOCKET_BASE_URL: 'http://localhost' } }));
jest.mock('../../src/components/ProfileImage', () => () => null);
jest.mock('../../src/lib/ludo/GameBoard', () => ({ GameBoard: () => null }));
jest.mock('../../src/lib/ludo/DiceSVG', () => ({ Dice3D: () => null }));
jest.mock('../../src/lib/ludo/PlayerEditorModal', () => ({ PlayerEditorModal: () => null }));
jest.mock('../../src/lib/ludo/useLudoAudio', () => ({
  useLudoAudio: () => ({ soundsEnabled: false, playSound: () => {}, toggleSounds: () => {} }),
}));

// Shorter paths (last 8 cells: 2 track cells + the 6-cell home column) and a
// quicker result display so a whole game fits in a test run. The web harness
// shortens its paths the same way so mixed games agree on the board.
jest.mock('../../src/lib/ludo/constants', () => {
  const actual = jest.requireActual('../../src/lib/ludo/constants');
  const PATHS = {};
  Object.keys(actual.PATHS).forEach((key) => {
    PATHS[Number(key)] = actual.PATHS[key].slice(-8);
  });
  return { ...actual, PATHS, DICE_ROLL_ANIMATION_MS: 300, DICE_RESULT_DISPLAY_MS: 400 };
});

jest.mock('../../src/lib/ludo/GameOverlays', () => {
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    GameEndedScreen: () => mockReact.createElement(Text, { testID: 'game-ended' }, 'GAME_ENDED'),
    IncomingInviteModal: ({ inviteRequest, onAccept }) =>
      inviteRequest
        ? mockReact.createElement(TouchableOpacity, { testID: 'invite-accept', onPress: onAccept })
        : null,
    WinnerModal: ({ winner, onContinueGame }) =>
      winner
        ? mockReact.createElement(TouchableOpacity, { testID: 'winner-continue', onPress: onContinueGame })
        : null,
    PlayerDock: ({ turnHint }) =>
      mockReact.createElement(View, null, mockReact.createElement(Text, { testID: 'turn-hint' }, turnHint)),
  };
});

jest.mock('../../src/lib/ludo/PlayerSelectionModal', () => {
  const { TouchableOpacity, View } = require('react-native');
  return {
    PlayerSelectionModal: (props) => {
      const { client } = mockReact.useContext(mockClientContext);
      if (!props.show) return null;
      const btn = (testID, onPress) =>
        mockReact.createElement(TouchableOpacity, { key: testID, testID, onPress });
      return mockReact.createElement(View, null, [
        btn('lobby-count', () => props.onPlayerCountChange(client.playerCount || 2)),
        btn('lobby-online', () => props.onOnlineModeToggle()),
        btn('lobby-invite', () => (client.inviteTargets || []).forEach((t) => props.onInviteConnect(t))),
        btn('lobby-confirm', () => props.onConfirmPlayerCount()),
      ]);
    },
  };
});
