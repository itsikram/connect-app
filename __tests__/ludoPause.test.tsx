/**
 * Online pause & save (Expo ↔ Expo) against the production ludoSocket.js:
 * a guest pauses, nobody can play, only the host may resume; the guest saves
 * & exits, finds the match under "Online games", rejoins the same board, and
 * after the host resumes the match plays to the end.
 */
require('./ludo/expoMocks');

const { act } = require('react-test-renderer');
const { startLudoServer, makeProfile, createClient, waitFor } = require('./ludo/harness');
const {
  findPressable,
  press,
  pause,
  mount,
  playStep,
  playUntilEnd,
  hostOnlineLobby,
  visibleState,
} = require('./ludo/expoAgent');
const LudoGameSVG = require('../src/screens/LudoGameSVG').default;

jest.setTimeout(10 * 60 * 1000);

describe('online Ludo pause & save (Expo clients)', () => {
  const PORT = 4880 + Number(process.env.JEST_WORKER_ID || 0);
  let server: any;
  const clients: any[] = [];

  beforeAll(() => {
    server = startLudoServer(PORT);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) {
      await act(async () => client.renderer?.unmount());
      client.socket.close();
    }
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const newClient = async (id: string, name: string, extra: Record<string, unknown> = {}) => {
    const client = Object.assign(
      createClient({ url: `http://localhost:${PORT}`, profile: makeProfile(id, name) }),
      extra,
    );
    clients.push(client);
    await waitFor(() => client.socket.connected, { label: `${name} socket` });
    await mount(client, LudoGameSVG);
    return client;
  };

  const has = (client: any, testID: string) =>
    client.renderer.root.findAll((n: any) => n.props?.testID === testID).length > 0;
  const diceEnabled = (client: any) => {
    const dice = findPressable(client, 'ludo-dice');
    return Boolean(dice && !dice.props.disabled);
  };
  const anyTokenEnabled = (client: any) =>
    client.renderer.root.findAll(
      (n: any) =>
        typeof n.props?.testID === 'string' &&
        n.props.testID.startsWith('ludo-token-') &&
        typeof n.props.onPress === 'function' &&
        !n.props.disabled,
    ).length > 0;
  const tokensOf = (client: any) => JSON.parse(visibleState(client)).tokens.sort().join('|');

  it('guest pauses, saves & exits, rejoins; host resumes and the match finishes', async () => {
    const guestId = 'f'.repeat(24);
    const host = await newClient('e'.repeat(24), 'Host', {
      playerCount: 2,
      inviteTargets: [{ _id: guestId, fullName: 'Guest' }],
    });
    const guest = await newClient(guestId, 'Guest');

    await hostOnlineLobby(host);
    await press(await waitFor(() => findPressable(guest, 'invite-accept'), { label: 'invite modal' }));
    await waitFor(() => diceEnabled(host), { timeout: 5000, label: 'match started' });

    // Play a little so the board has state worth saving.
    for (let i = 0; i < 12; i += 1) {
      await playStep(host);
      await playStep(guest);
      await pause(250);
    }

    // Guest pauses (once its pause button is enabled: not mid-roll/move).
    const pauseBtn = await waitFor(
      () => {
        const b = findPressable(guest, 'ludo-pause');
        return b && !b.props.disabled ? b : null;
      },
      { timeout: 15000, label: 'guest pause button' },
    );
    await press(pauseBtn);
    await waitFor(() => has(host, 'ludo-paused') && has(guest, 'ludo-paused'), {
      timeout: 5000,
      label: 'both paused',
    });
    expect(findPressable(host, 'ludo-resume')).toBeTruthy();
    expect(findPressable(guest, 'ludo-resume')).toBeUndefined();

    // Frozen: no dice or token is playable on either side, the board holds.
    await pause(1500);
    const frozenHost = tokensOf(host);
    await pause(2500);
    expect(tokensOf(host)).toBe(frozenHost);
    expect(diceEnabled(host) || diceEnabled(guest)).toBe(false);
    expect(anyTokenEnabled(host) || anyTokenEnabled(guest)).toBe(false);

    // Guest saves & exits: back on the menu, the match is listed.
    await press(findPressable(guest, 'ludo-save-exit'));
    await waitFor(() => has(guest, 'ludo-saved-games'), { label: 'guest menu' });
    const listed = await waitFor(
      () =>
        guest.renderer.root.findAll(
          (n: any) =>
            typeof n.props?.testID === 'string' &&
            n.props.testID.startsWith('ludo-online-') &&
            typeof n.props.onPress === 'function',
        )[0],
      { timeout: 5000, label: 'saved online game listed' },
    );
    expect(has(host, 'ludo-paused')).toBe(true);

    // Rejoin: same board as the host, still paused.
    await press(listed);
    await waitFor(() => has(guest, 'ludo-paused') && tokensOf(guest) === tokensOf(host), {
      timeout: 8000,
      label: 'guest back on the same paused board',
    });

    // Host resumes; the match plays to the end.
    await press(findPressable(host, 'ludo-resume'));
    await waitFor(() => !has(host, 'ludo-paused') && !has(guest, 'ludo-paused'), {
      timeout: 5000,
      label: 'resumed for both',
    });
    const result = await playUntilEnd([host, guest]);
    expect(result.actions).toBeGreaterThan(0);
  });
});
