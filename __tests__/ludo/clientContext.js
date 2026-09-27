// Per-client values for the online Ludo harness. The module mocks in
// ludoOnline.test.tsx read from this context so two game screens can run side
// by side, each with its own profile, socket and Ludo context.
const React = require('react');

const ClientContext = React.createContext(null);

module.exports = { ClientContext };
