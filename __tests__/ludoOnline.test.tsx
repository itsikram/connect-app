/**
 * Online Ludo harness (Expo ↔ Expo): renders the real LudoGameSVG screen for
 * every player, each connected through a real socket.io client to an
 * in-process server running the production server/sockets/ludoSocket.js.
 * Every client is driven by a bot that taps the dice or a playable token
 * whenever the UI allows it; a test fails if the game stops progressing.
 *
 * Mixed web/Expo games use the same agent through ludoOnlineRole.test.tsx and
 * tests/ludo-e2e/run.js at the repository root.
 */
require('./ludo/expoMocks');

const { act } = require('react-test-renderer');
const { startLudoServer, makeProfile, createClient, waitFor } = require('./ludo/harness');
const {
  findPressable,
  press,
  pause,
  mount,
  playUntilEnd,
  hostOnlineLobby,
  hasGameEnded,
  findAllText,
} = require('./ludo/expoAgent');
const LudoGameSVG = require('../src/screens/LudoGameSVG').default;

jest.setTimeout(10 * 60 * 1000);

describe('online Ludo (Expo clients)', () => {
  const PORT = 4870 + Number(process.env.JEST_WORKER_ID || 0);
  let server: any;
  const clients: any[] = [];

  beforeAll(() => {
    server = startLudoServer(PORT);
    // Timers inside the game update state outside act(); that is expected here.
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

  const diceEnabled = (client: any) => {
    const dice = findPressable(client, 'ludo-dice');
    return Boolean(dice && !dice.props.disabled);
  };

  const guestSeesStartedBoard = (guest: any) =>
    !findAllText(guest).some((text: string) => /Waiting for players/i.test(text));

  it('2 players, invite modal accept: game starts at once and plays to the end', async () => {
    const guestId = 'b'.repeat(24);
    const host = await newClient('a'.repeat(24), 'Host', {
      playerCount: 2,
      inviteTargets: [{ _id: guestId, fullName: 'Guest' }],
    });
    const guest = await newClient(guestId, 'Guest');

    await hostOnlineLobby(host);
    const accept = await waitFor(() => findPressable(guest, 'invite-accept'), { label: 'invite modal' });
    const acceptedAt = Date.now();
    await press(accept);

    await waitFor(() => diceEnabled(host) && guestSeesStartedBoard(guest), {
      timeout: 3000,
      label: 'match started after accept',
    });
    expect(Date.now() - acceptedAt).toBeLessThan(3000);

    const result = await playUntilEnd([host, guest]);
    expect(result.actions).toBeGreaterThan(0);
  });

  it('3 players, accept from the app header: uninvited seat is a computer, starts at once', async () => {
    const guestId = 'd'.repeat(24);
    const host = await newClient('c'.repeat(24), 'Host3', {
      playerCount: 3,
      inviteTargets: [{ _id: guestId, fullName: 'Guest3' }],
    });
    const guest = await newClient(guestId, 'Guest3', { ludoActive: false });

    await hostOnlineLobby(host);
    // The header listens for ludo:invite app-wide and hands it to the screen.
    const invite = await waitFor(
      () => guest.events.find((e: any) => e.event === 'ludo:invite')?.payload,
      { label: 'invite event' },
    );
    const acceptedAt = Date.now();
    await act(async () => {
      guest.pendingLudoInvite = {
        id: invite.by,
        name: invite.name,
        gameId: invite.gameId,
        by: invite.by,
        playerCount: invite.playerCount,
        slotIndex: invite.slotIndex,
      };
      guest.ludoActive = true;
      guest.notify();
    });

    await waitFor(() => diceEnabled(host) && guestSeesStartedBoard(guest), {
      timeout: 3000,
      label: 'match started after accept',
    });
    expect(Date.now() - acceptedAt).toBeLessThan(3000);

    await playUntilEnd([host, guest]);
  });

  it('slow connection: shows reconnecting, then resumes and finishes', async () => {
    const guestId = 'f'.repeat(24);
    const host = await newClient('e'.repeat(24), 'HostR', {
      playerCount: 2,
      inviteTargets: [{ _id: guestId, fullName: 'GuestR' }],
    });
    const guest = await newClient(guestId, 'GuestR');
    await hostOnlineLobby(host);
    await press(await waitFor(() => findPressable(guest, 'invite-accept'), { label: 'invite modal' }));
    await waitFor(() => diceEnabled(host), { timeout: 3000, label: 'host dice' });

    let dropped = false;
    await playUntilEnd([host, guest], {
      onTick: async ({ actions }: { actions: number }) => {
        if (dropped || actions < 6) return;
        dropped = true;
        // Take the guest offline for 3s, as a flaky mobile network would.
        guest.socket.disconnect();
        await waitFor(() => !guest.socket.connected, { label: 'guest disconnected' });
        await pause(1500);
        const overlays = (c: any) =>
          c.renderer.root.findAll((n: any) => n.props?.testID === 'ludo-reconnecting').length;
        expect(overlays(guest)).toBeGreaterThan(0);
        // The host sees who dropped and keeps playing.
        await waitFor(
          () => host.renderer.root.findAll((n: any) => n.props?.testID === 'ludo-peer-offline').length > 0,
          { timeout: 3000, label: 'host sees guest reconnecting' },
        );
        expect(overlays(host)).toBe(0);
        await pause(1500);
        guest.socket.connect();
        await waitFor(() => guest.socket.connected, { label: 'guest reconnected' });
        await waitFor(
          () => guest.renderer.root.findAll((n: any) => n.props?.testID === 'ludo-reconnecting').length === 0,
          { timeout: 5000, label: 'reconnecting overlay hidden' },
        );
      },
    });
    expect(hasGameEnded(host) && hasGameEnded(guest)).toBe(true);
  });
});
