// Drives rendered LudoGameSVG screens like a person would: taps the dice when
// it is tappable, otherwise a glowing token, and reports stalls with a trace
// of the socket events each client received.
const React = require('react');
const TestRenderer = require('react-test-renderer');
const { ClientProvider, TestLudoNavigator } = require('./harness');

const { act } = TestRenderer;

const findPressable = (client, testID) =>
  client.renderer.root.findAll(
    (node) => node.props && node.props.testID === testID && typeof node.props.onPress === 'function',
  )[0];

const press = async (node) => {
  await act(async () => {
    node.props.onPress();
  });
};

// Waits in short act() slices so state updates (and the effects they
// trigger) are applied as time passes, like on a device, instead of being
// held until the end of one long act scope.
const pause = async (ms) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, Math.min(100, until - Date.now())));
    });
  }
};

const hasGameEnded = (client) =>
  client.renderer.root.findAll((node) => node.props && node.props.testID === 'game-ended').length > 0;

const tokenNodes = (client) =>
  client.renderer.root.findAll(
    (n) =>
      n.props &&
      typeof n.props.testID === 'string' &&
      n.props.testID.startsWith('ludo-token-') &&
      typeof n.props.onPress === 'function',
  );

const findText = (client, testID) => {
  const node = client.renderer.root.findAll(
    (n) => n.props && n.props.testID === testID && typeof n.props.children === 'string',
  )[0];
  return node ? node.props.children : undefined;
};

const findAllText = (client) =>
  client.renderer.root
    .findAll((n) => n.type === 'Text' || (n.props && typeof n.props.children === 'string'))
    .map((n) => n.props.children)
    .filter((c) => typeof c === 'string');

const visibleState = (client) => {
  const tokens = tokenNodes(client).map((n) => `${n.props.testID}@${n.props.style.left},${n.props.style.top}`);
  const dice = findPressable(client, 'ludo-dice');
  return JSON.stringify({
    tokens: Array.from(new Set(tokens)),
    hint: findText(client, 'turn-hint'),
    diceDisabled: dice ? dice.props.disabled : undefined,
    ended: hasGameEnded(client),
  });
};

const traceOf = (client, count = 16) =>
  client.events
    .slice(-count)
    .map(({ event, payload, at }) => {
      const p = payload || {};
      const bits = [
        p.lastActionType,
        typeof p.currentPlayer === 'number' ? `cp=${p.currentPlayer}` : '',
        typeof p.diceValue === 'number' ? `dice=${p.diceValue}` : '',
        typeof p.value === 'number' ? `value=${p.value}` : '',
        p.lastAction ? `act=${p.lastAction.type}${p.lastAction.type === 'move' ? `:${p.lastAction.seat}.${p.lastAction.piece}->${p.lastAction.to}` : ''}` : '',
        typeof p.phase === 'string' ? `phase=${p.phase}` : '',
        typeof p.status === 'string' ? `status=${p.status}` : '',
        p.version ? `v=${p.version}` : '',
        p.by ? `by=${String(p.by).slice(-4)}` : '',
      ].filter(Boolean);
      return `    ${at % 100000} ${event} ${bits.join(' ')}`;
    })
    .join('\n');

const mount = async (client, Component = TestLudoNavigator) => {
  await act(async () => {
    client.renderer = TestRenderer.create(
      React.createElement(ClientProvider, { client }, React.createElement(Component)),
    );
  });
};

// One step of play for one client. Returns true if it pressed something.
const playStep = async (client) => {
  if (hasGameEnded(client)) return false;
  const winner = findPressable(client, 'winner-continue');
  if (winner) await press(winner);
  const dice = findPressable(client, 'ludo-dice');
  if (dice && !dice.props.disabled) {
    await press(dice);
    return true;
  }
  const token = tokenNodes(client).find((n) => !n.props.disabled);
  if (token) {
    await press(token);
    return true;
  }
  return false;
};

// Plays every client until all show the game-ended screen. Fails when nothing
// visible changes for stallMs while the game is still running.
const playUntilEnd = async (clients, { stallMs = 20000, maxMs = 8 * 60 * 1000, onTick } = {}) => {
  const started = Date.now();
  let lastChange = Date.now();
  let lastSignature = '';
  let actions = 0;
  for (;;) {
    if (clients.every(hasGameEnded)) return { actions, ms: Date.now() - started };
    for (const client of clients) {
      if (await playStep(client)) actions += 1;
    }
    if (onTick) await onTick({ actions, elapsed: Date.now() - started });
    const signature = clients.map(visibleState).join('|');
    if (signature !== lastSignature) {
      lastSignature = signature;
      lastChange = Date.now();
    }
    if (Date.now() - lastChange > stallMs) {
      throw new Error(
        `Game stalled for ${stallMs}ms after ${actions} actions.\n` +
          clients.map((c) => `${c.profile.fullName}: ${visibleState(c)}\n${traceOf(c)}`).join('\n'),
      );
    }
    if (Date.now() - started > maxMs) throw new Error(`Game did not finish within ${maxMs}ms`);
    await pause(150);
  }
};

const hasReconnectingOverlay = (client) =>
  client.renderer.root.findAll((n) => n.props && n.props.testID === 'ludo-reconnecting').length > 0;

// Cuts the client's connection for outageMs like a network blip (transport
// dies, socket.io reconnects by itself) and checks the reconnecting overlay.
const dropConnection = async (client, outageMs = 3000) => {
  const manager = client.socket.io;
  const delay = manager.reconnectionDelay();
  const delayMax = manager.reconnectionDelayMax();
  manager.reconnectionDelay(outageMs);
  manager.reconnectionDelayMax(outageMs);
  manager.randomizationFactor(0);
  manager.engine.close();
  await pause(1500);
  if (!hasReconnectingOverlay(client)) {
    throw new Error(`reconnecting overlay not shown during outage\n${visibleState(client)}`);
  }
  const started = Date.now();
  while (!client.socket.connected) {
    if (Date.now() - started > outageMs + 5000) throw new Error('socket did not reconnect');
    await pause(100);
  }
  manager.reconnectionDelay(delay);
  manager.reconnectionDelayMax(delayMax);
  const shownUntil = Date.now() + 6000;
  while (hasReconnectingOverlay(client)) {
    if (Date.now() > shownUntil) throw new Error('reconnecting overlay stayed after reconnect');
    await pause(100);
  }
};

// Opens the new-game dialog (it opens by itself on a first visit) and
// creates an online game inviting the client's inviteTargets.
const hostOnlineLobby = async (host) => {
  const started = Date.now();
  while (!findPressable(host, 'lobby-count')) {
    const start = findPressable(host, 'ludo-start-new');
    if (start) await press(start);
    if (Date.now() - started > 15000) throw new Error('new-game dialog did not open');
    await pause(100);
  }
  await press(findPressable(host, 'lobby-count'));
  await press(findPressable(host, 'lobby-online'));
  await press(findPressable(host, 'lobby-invite'));
  await press(findPressable(host, 'lobby-confirm'));
};

module.exports = {
  act,
  findPressable,
  press,
  pause,
  hasGameEnded,
  visibleState,
  traceOf,
  mount,
  playStep,
  playUntilEnd,
  hostOnlineLobby,
  dropConnection,
  hasReconnectingOverlay,
  findText,
  findAllText,
};
