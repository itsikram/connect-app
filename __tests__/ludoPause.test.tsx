/**
 * Pause, save & rejoin, and replacing an away player with the computer
 * (Expo ↔ Expo) against the production game server (server-hosted games).
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

jest.setTimeout(10 * 60 * 1000);

describe('Ludo pause, save & rejoin, replace with computer (Expo clients)', () => {
  const PORT = 4890 + Number(process.env.JEST_WORKER_ID || 0);
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
    await mount(client);
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

  const startMatch = async (hostId: string, guestId: string) => {
    const host = await newClient(hostId, 'Host', {
      playerCount: 2,
      inviteTargets: [{ _id: guestId, fullName: 'Guest' }],
    });
    const guest = await newClient(guestId, 'Guest');
    await hostOnlineLobby(host);
    await press(await waitFor(() => findPressable(guest, 'invite-accept'), { label: 'invite dialog' }));
    await waitFor(() => diceEnabled(host), { timeout: 5000, label: 'match started' });
    return { host, guest };
  };

  it('guest pauses, saves & exits, rejoins from Your games; the guest resumes and the match finishes', async () => {
    const { host, guest } = await startMatch('e'.repeat(24), 'f'.repeat(24));
    const gameId = host.route.gameId;
    expect(guest.route.gameId).toBe(gameId);

    for (let i = 0; i < 12; i += 1) {
      await playStep(host);
      await playStep(guest);
      await pause(200);
    }

    const pauseBtn = await waitFor(
      () => {
        const b = findPressable(guest, 'ludo-pause');
        return b && !b.props.disabled ? b : null;
      },
      { timeout: 15000, label: 'guest pause button' },
    );
    await press(pauseBtn);
    await waitFor(() => has(host, 'ludo-paused') && has(guest, 'ludo-paused'), { timeout: 5000, label: 'both paused' });
    // The server runs the game, so any player in it can resume.
    expect(findPressable(host, 'ludo-resume')).toBeTruthy();
    expect(findPressable(guest, 'ludo-resume')).toBeTruthy();

    // Frozen: nothing playable, the board holds still.
    await pause(1500);
    const frozen = tokensOf(host);
    await pause(2000);
    expect(tokensOf(host)).toBe(frozen);
    expect(diceEnabled(host) || diceEnabled(guest)).toBe(false);
    expect(anyTokenEnabled(host) || anyTokenEnabled(guest)).toBe(false);

    // Guest saves & exits: back on the Ludo menu, the game is listed.
    await press(findPressable(guest, 'ludo-save-exit'));
    await waitFor(() => has(guest, 'ludo-your-games'), { label: 'guest menu' });
    expect(guest.route.gameId).toBeNull();
    const listed = await waitFor(() => findPressable(guest, `ludo-game-${gameId}`), {
      timeout: 5000,
      label: 'saved game listed',
    });
    await waitFor(() => has(host, 'ludo-peer-offline'), { timeout: 5000, label: 'host sees guest away' });

    // Rejoin: same board, still paused.
    await press(listed);
    await waitFor(() => guest.route.gameId === gameId && has(guest, 'ludo-paused') && tokensOf(guest) === tokensOf(host), {
      timeout: 8000,
      label: 'guest back on the same paused board',
    });
    await waitFor(() => !has(host, 'ludo-peer-offline'), { timeout: 5000, label: 'host sees guest back' });

    await press(findPressable(guest, 'ludo-resume'));
    await waitFor(() => !has(host, 'ludo-paused') && !has(guest, 'ludo-paused'), { timeout: 5000, label: 'resumed' });
    const result = await playUntilEnd([host, guest]);
    expect(result.actions).toBeGreaterThan(0);
  });

  it('host replaces an away guest with the computer, which then plays the match out', async () => {
    const { host, guest } = await startMatch('1'.repeat(24), '2'.repeat(24));
    const gameId = host.route.gameId;

    // The guest leaves the board (seat kept): the host is offered the computer.
    await press(findPressable(guest, 'ludo-menu'));
    await waitFor(() => has(guest, 'ludo-your-games'), { label: 'guest menu' });
    const replace = await waitFor(() => findPressable(host, 'peer-replace-bot-1'), { timeout: 5000, label: 'use computer button' });
    await press(replace);
    await waitFor(() => !has(host, 'ludo-peer-offline'), { timeout: 5000, label: 'banner gone' });

    // The game drops out of the guest's list.
    await waitFor(() => !findPressable(guest, `ludo-game-${gameId}`), { timeout: 5000, label: 'game left the guest list' });

    const result = await playUntilEnd([host]);
    expect(result.actions).toBeGreaterThan(0);
  });
});
