/**
 * One Expo player in a cross-platform online Ludo match. Started by
 * tests/ludo-e2e/run.js (repository root), which runs the shared server and
 * the opposing web or Expo player in separate processes. Skipped otherwise.
 *
 * Env: LUDO_E2E_URL, LUDO_E2E_ROLE (host|guest), LUDO_E2E_SELF, LUDO_E2E_PEER,
 *      LUDO_E2E_PLAYERS (2-4, host only).
 */
require('./ludo/expoMocks');

const { act } = require('react-test-renderer');
const { makeProfile, createClient, waitFor } = require('./ludo/harness');
const {
  findPressable,
  press,
  mount,
  playUntilEnd,
  hostOnlineLobby,
  findAllText,
  traceOf,
  dropConnection,
} = require('./ludo/expoAgent');
const LudoGameSVG = require('../src/screens/LudoGameSVG').default;

const url = process.env.LUDO_E2E_URL;
const role = process.env.LUDO_E2E_ROLE;
const run = url && role ? it : it.skip;

jest.setTimeout(12 * 60 * 1000);

run(`Expo ${role} plays a full online match`, async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  const self = String(process.env.LUDO_E2E_SELF);
  const peer = String(process.env.LUDO_E2E_PEER);
  const client = Object.assign(createClient({ url, profile: makeProfile(self, `Expo ${role}`) }), {
    playerCount: Number(process.env.LUDO_E2E_PLAYERS || 2),
    inviteTargets: [{ _id: peer, fullName: 'Peer' }],
  });
  await waitFor(() => client.socket.connected, { label: 'socket' });
  await mount(client, LudoGameSVG);

  const dumpOnFailure = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (error) {
      const sent = client.sent.map((s: any) => `    ${s.at % 100000} SENT ${s.event} ${s.from}`).join('\n');
      process.stdout.write(`[expo ${role}] sent:\n${sent}\n[expo ${role}] received:\n${traceOf(client, 30)}\n`);
      throw error;
    }
  };

  await dumpOnFailure(async () => {
  if (role === 'host') {
    await hostOnlineLobby(client);
  } else {
    const accept = await waitFor(() => findPressable(client, 'invite-accept'), {
      timeout: 60000,
      label: 'invite from the host',
    });
    const acceptedAt = Date.now();
    await press(accept);
    await waitFor(
      () => !findAllText(client).some((t: string) => /Joining the match|Waiting for players/i.test(t)),
      { timeout: 3000, label: 'match started after accept' },
    );
    process.stdout.write(`[expo guest] match started ${Date.now() - acceptedAt}ms after accept\n`);
  }

  let dropped = process.env.LUDO_E2E_DROP !== role;
  const result = await playUntilEnd([client], {
    stallMs: 25000,
    maxMs: 10 * 60 * 1000,
    onTick: async ({ actions }: { actions: number }) => {
      if (dropped || actions < 6) return;
      dropped = true;
      await dropConnection(client);
      process.stdout.write(`[expo ${role}] recovered from a 3000ms outage\n`);
    },
  });
  process.stdout.write(`[expo ${role}] game ended after ${result.actions} actions in ${result.ms}ms\n`);
  });
  await act(async () => client.renderer.unmount());
  client.socket.close();
});
