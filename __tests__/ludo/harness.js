// Test-only helpers: a real Ludo socket server and a client wrapper that
// connects a rendered LudoGameSVG to it, plus an autonomous "player" that taps
// the dice / a playable token whenever the UI allows it.
const path = require('path');
const React = require('react');
const { io: ioClient } = require('socket.io-client');
const { ClientContext } = require('./clientContext');

const SERVER_DIR = path.resolve(__dirname, '../../../server');

const startLudoServer = (port) => {
  const { Server } = require(path.join(SERVER_DIR, 'node_modules/socket.io'));
  const { debugLogger } = require(path.join(SERVER_DIR, 'utils/debugLogger'));
  Object.keys(debugLogger || {}).forEach((key) => {
    debugLogger[key] = () => {};
  });
  const ludoSocket = require(path.join(SERVER_DIR, 'sockets/ludoSocket'));
  const server = new Server(port, { cors: { origin: '*' } });
  server.on('connection', (socket) => {
    const profileId = socket.handshake.query?.profile;
    if (profileId) socket.join(String(profileId));
    ludoSocket(server, socket, profileId);
  });
  return server;
};

const makeProfile = (id, name) => ({
  _id: id,
  fullName: name,
  profilePic: '',
  coverPic: '',
});

// One connected client: socket + context value consumed by the module mocks.
const createClient = ({ url, profile }) => {
  const socket = ioClient(url, {
    query: { profile: profile._id },
    transports: ['websocket'],
    reconnectionDelay: 200,
    reconnectionDelayMax: 500,
  });
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn());
  socket.on('connect', notify);
  socket.on('disconnect', notify);

  const client = {
    profile,
    socket,
    pendingLudoInvite: null,
    ludoActive: true,
    events: [],
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    notify,
  };
  socket.onAny((event, payload) => client.events.push({ event, payload, at: Date.now() }));
  // Record what this client sends (with the calling frame) for diagnostics.
  client.sent = [];
  const rawEmit = socket.emit.bind(socket);
  socket.emit = (event, ...args) => {
    if (event !== 'ludo:ping') {
      const frame = (new Error().stack || '').split('\n').find((l) => l.includes('/src/') || l.includes('\\src\\'));
      client.sent.push({ event, at: Date.now(), from: frame ? frame.trim() : '' });
    }
    return rawEmit(event, ...args);
  };
  return client;
};

// Provider that exposes the client to the mocked hooks and re-renders when the
// connection or Ludo context changes.
const ClientProvider = ({ client, children }) => {
  const [, setTick] = React.useState(0);
  React.useEffect(() => client.subscribe(() => setTick((t) => t + 1)), [client]);
  // Stable callbacks, like the app's SocketContext (useCallback).
  const api = React.useMemo(
    () => ({
      emit: (event, data, ack) =>
        typeof ack === 'function' ? client.socket.emit(event, data, ack) : client.socket.emit(event, data),
      on: (event, cb) => client.socket.on(event, cb),
      off: (event, cb) => (cb ? client.socket.off(event, cb) : client.socket.off(event)),
    }),
    [client],
  );
  const value = { client, isConnected: client.socket.connected, ...api };
  return React.createElement(ClientContext.Provider, { value }, children);
};

const waitFor = async (predicate, { timeout = 10000, interval = 50, label = 'condition' } = {}) => {
  const started = Date.now();
  for (;;) {
    const result = predicate();
    if (result) return result;
    if (Date.now() - started > timeout) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
};

module.exports = {
  startLudoServer,
  makeProfile,
  createClient,
  ClientProvider,
  waitFor,
};
