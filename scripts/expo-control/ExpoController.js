'use strict';

/**
 * Owns the `expo start` child process and everything around it: tunnel URL
 * discovery, readiness, health checks, auto-recovery, bundle pre-warming and
 * the connected-device list. Emits `state` and `log` events for the HTTP layer.
 */

const { spawn } = require('child_process');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const sys = require('./system');
const { REPORT_MARKER } = require('./tunnelBoost');

let WebSocketImpl = null;
try {
  WebSocketImpl = require('ws');
} catch (_) {
  WebSocketImpl = typeof WebSocket === 'function' ? WebSocket : null;
}

const METRO_PORT = Number(process.env.EXPO_CONTROL_METRO_PORT) || 8081;
const LOCAL_URL = `http://127.0.0.1:${METRO_PORT}`;
const LOG_LIMIT = 1500;
const HISTORY_LIMIT = 40;
const BUNDLE_HISTORY_LIMIT = 12;
const HEALTH_INTERVAL_MS = 10000;
const DEVICE_POLL_MS = 4000;
const IDLE_PORT_CHECK_MS = 10000;
const FAILS_BEFORE_DOWN = 3;
const SLOW_LATENCY_MS = 1500;
const START_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_START_ATTEMPTS = 3;
const RECOVERY_WINDOW_MS = 10 * 60 * 1000;
const RECOVERY_MAX = 3;

const DEFAULT_OPTIONS = Object.freeze({
  mode: 'tunnel', // 'tunnel' | 'lan'
  provider: 'ngrok', // 'ngrok' | 'expo-ws'
  bundleMode: 'development', // 'development' | 'production'
  compress: true,
  prewarm: true,
  autoRecover: true,
});

const OPTION_VALUES = {
  mode: ['tunnel', 'lan'],
  provider: ['ngrok', 'expo-ws'],
  bundleMode: ['development', 'production'],
};

const ANSI_PATTERN = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const TUNNEL_FAILURE = /ngrok status page|failed to start tunnel|tunnel took too long|remote gone away|NGROK_|WS_TUNNEL|Tunnel connection has been closed/i;
// Matches "Error", "CommandError", "TypeError", "failed"… but not "0 errors" or "errorHandler".
const ERROR_LINE = /\b\w*(error|exception)\b|\bfailed\b/i;

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function sanitizeOptions(input = {}) {
  const clean = {};
  for (const [key, allowed] of Object.entries(OPTION_VALUES)) {
    if (input[key] !== undefined) {
      if (!allowed.includes(input[key])) throw new HttpError(400, `Invalid ${key}: ${input[key]}`, 'BAD_OPTION');
      clean[key] = input[key];
    }
  }
  for (const key of ['compress', 'prewarm', 'autoRecover']) {
    if (input[key] !== undefined) clean[key] = Boolean(input[key]);
  }
  return clean;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function parsePeerQuery(query) {
  if (!query) return {};
  if (typeof query === 'string') return Object.fromEntries(new URLSearchParams(query));
  return query;
}

class ExpoController extends EventEmitter {
  constructor({ projectRoot, version }) {
    super();
    this.projectRoot = projectRoot;
    this.settingsFile = path.join(projectRoot, '.expo', 'expo-control.json');
    this.expoSettingsFile = path.join(projectRoot, '.expo', 'settings.json');
    this.options = { ...DEFAULT_OPTIONS, ...this.loadOptions() };
    // The ngrok hostname is derived from .expo/settings.json -> urlRandomness.
    // Expo regenerates it after some tunnel errors; we pin the last one that
    // worked so the Expo Go URL stays the same across restarts.
    this.stableUrlRandomness = this.loadSavedValue('stableUrlRandomness') || this.readExpoSettings().urlRandomness || null;
    this.logs = [];
    this.logSeq = 0;
    this.child = null;
    this.runId = 0;
    this.queue = Promise.resolve();
    this.timers = {};
    this.recoveries = [];
    this.lineBuffers = { stdout: '', stderr: '' };
    this.recentErrors = [];
    this.recentOutput = [];
    this.deviceSocket = null;
    this.state = {
      status: 'stopped',
      phase: null,
      pid: null,
      startedAt: null,
      readyAt: null,
      attempt: 0,
      options: { ...this.options },
      activeOptions: null,
      urls: { expoGo: null, tunnel: null, lan: null, local: `http://localhost:${METRO_PORT}` },
      metroUp: false,
      tunnel: { status: 'idle', url: null, since: null },
      health: { status: 'unknown', latencyMs: null, localMs: null, checkedAt: null, failures: 0, history: [] },
      devices: [],
      devicesSupported: Boolean(WebSocketImpl),
      prewarm: { status: 'idle', ms: null, bytes: null, error: null, at: null },
      bundles: [],
      error: null,
      portBusy: null,
      lastExit: null,
      restarts: 0,
      controller: { pid: process.pid, startedAt: Date.now(), version, port: METRO_PORT },
    };
    this.startIdleWatch();
  }

  // ---------------------------------------------------------------- state

  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  setState(patch) {
    Object.assign(this.state, patch);
    this.emit('state');
  }

  log(text, stream = 'system', level) {
    const entry = {
      id: ++this.logSeq,
      t: Date.now(),
      stream,
      level: level || (ERROR_LINE.test(text) ? 'error' : /\bwarn(ing)?\b/i.test(text) ? 'warn' : 'info'),
      text,
    };
    this.logs.push(entry);
    if (this.logs.length > LOG_LIMIT) this.logs.splice(0, this.logs.length - LOG_LIMIT);
    if (stream !== 'system') {
      this.recentOutput.push(text);
      if (this.recentOutput.length > 40) this.recentOutput.shift();
    }
    if (entry.level === 'error' && stream !== 'system') {
      this.recentErrors.push(text);
      if (this.recentErrors.length > 8) this.recentErrors.shift();
    }
    this.emit('log', entry);
  }

  getLogs(sinceId = 0, limit = 400) {
    return this.logs.filter((entry) => entry.id > sinceId).slice(-limit);
  }

  clearLogs() {
    this.logs = [];
    this.emit('logs-cleared');
  }

  loadOptions() {
    try {
      return sanitizeOptions(JSON.parse(fs.readFileSync(this.settingsFile, 'utf8')));
    } catch (_) {
      return {};
    }
  }

  loadSavedValue(key) {
    try {
      return JSON.parse(fs.readFileSync(this.settingsFile, 'utf8'))[key];
    } catch (_) {
      return undefined;
    }
  }

  readExpoSettings() {
    try {
      return JSON.parse(fs.readFileSync(this.expoSettingsFile, 'utf8')) || {};
    } catch (_) {
      return {};
    }
  }

  /** Put back the tunnel hostname that last worked (Expo may have rotated it after an error). */
  restoreStableUrl() {
    if (!this.stableUrlRandomness) return;
    const settings = this.readExpoSettings();
    if (settings.urlRandomness === this.stableUrlRandomness) return;
    try {
      fs.mkdirSync(path.dirname(this.expoSettingsFile), { recursive: true });
      fs.writeFileSync(this.expoSettingsFile, JSON.stringify({ ...settings, urlRandomness: this.stableUrlRandomness }, null, 2));
      this.log('Restored your usual tunnel URL', 'system');
    } catch (error) {
      this.log(`Could not restore the tunnel URL: ${error.message}`, 'system', 'warn');
    }
  }

  rememberStableUrl() {
    const current = this.readExpoSettings().urlRandomness;
    if (current && current !== this.stableUrlRandomness) {
      this.stableUrlRandomness = current;
      this.saveOptions();
    }
  }

  saveOptions() {
    try {
      fs.mkdirSync(path.dirname(this.settingsFile), { recursive: true });
      const saved = { ...this.options, stableUrlRandomness: this.stableUrlRandomness || undefined };
      fs.writeFileSync(this.settingsFile, JSON.stringify(saved, null, 2));
    } catch (error) {
      this.log(`Could not save controller options: ${error.message}`, 'system', 'warn');
    }
  }

  updateOptions(input) {
    this.options = { ...this.options, ...sanitizeOptions(input) };
    this.saveOptions();
    this.setState({ options: { ...this.options } });
    return this.options;
  }

  /** Serialize start/stop/restart so rapid clicks cannot spawn two servers. */
  enqueue(task) {
    const result = this.queue.then(task, task);
    this.queue = result.catch(() => {});
    return result;
  }

  // ------------------------------------------------------------ lifecycle

  start(input = {}) {
    return this.enqueue(() => this.startNow(input));
  }

  stop() {
    return this.enqueue(() => this.stopNow('Stopped from the web console'));
  }

  restart(input = {}) {
    return this.enqueue(async () => {
      await this.stopNow('Restarting');
      this.setState({ restarts: this.state.restarts + 1 });
      return this.startNow(input);
    });
  }

  async startNow(input = {}, { attempt = 1 } = {}) {
    if (this.child) throw new HttpError(409, 'The Expo server is already running.', 'ALREADY_RUNNING');
    const { clearCache, ...rest } = input;
    this.updateOptions(rest);
    const options = { ...this.options };

    const runId = ++this.runId;
    this.recentErrors = [];
    this.recentOutput = [];
    this.setState({
      status: 'starting',
      phase: 'Checking port',
      attempt,
      error: null,
      activeOptions: options,
      metroUp: false,
      urls: { ...this.state.urls, expoGo: null, tunnel: null, lan: null },
      tunnel: { status: options.mode === 'tunnel' ? 'connecting' : 'idle', url: null, since: null },
      health: { status: 'unknown', latencyMs: null, localMs: null, checkedAt: null, failures: 0, history: [] },
      prewarm: { status: 'idle', ms: null, bytes: null, error: null, at: null },
      devices: [],
      readyAt: null,
    });

    const busy = await this.inspectPort();
    if (busy) {
      this.setState({
        status: 'error',
        phase: null,
        activeOptions: null,
        tunnel: { status: 'idle', url: null, since: null },
        error: {
          code: 'PORT_IN_USE',
          message: `Port ${METRO_PORT} is already in use by ${busy.name || 'another process'}${busy.pid ? ` (PID ${busy.pid})` : ''}.`,
          hint: 'Another Metro/Expo server is probably still running. Use "Free port" to stop it, then start again.',
        },
      });
      return this.getState();
    }

    let cliPath;
    try {
      cliPath = require.resolve('expo/bin/cli', { paths: [this.projectRoot] });
    } catch (_) {
      this.setState({
        status: 'error',
        phase: null,
        error: { code: 'EXPO_MISSING', message: 'The expo package is not installed.', hint: 'Run "npm install" in expo-connect-app.' },
      });
      return this.getState();
    }

    // Retries keep Expo's rotated hostname: the pinned one just failed.
    if (attempt === 1 && options.mode === 'tunnel' && options.provider === 'ngrok') this.restoreStableUrl();

    const args = [cliPath, 'start', '--port', String(METRO_PORT), '--go', options.mode === 'tunnel' ? '--tunnel' : '--lan'];
    if (options.bundleMode === 'production') args.push('--no-dev', '--minify');
    if (clearCache) args.push('--clear');

    const env = {
      ...process.env,
      FORCE_COLOR: '0',
      BROWSER: 'none',
      EXPO_TUNNEL_BOOST: options.compress ? '1' : '0',
      // Expo only prints the tunnel URL on its debug channel in non-interactive mode.
      DEBUG: [process.env.DEBUG, 'expo:start:server:ngrok', 'expo:start:server:ws-tunnel'].filter(Boolean).join(','),
    };
    // CI=true makes Metro skip file watching, which would break Fast Refresh.
    delete env.CI;
    // Inherited from the web dev server when it launched this daemon; Expo
    // must pick these from --no-dev itself or Babel transforms change.
    delete env.NODE_ENV;
    delete env.BABEL_ENV;
    // Tells the app (src/lib/config.ts) to use the live servers: a phone on the
    // tunnel cannot reach this PC's LAN API.
    if (options.mode === 'tunnel') env.EXPO_PUBLIC_CONNECT_TUNNEL = '1';
    else delete env.EXPO_PUBLIC_CONNECT_TUNNEL;
    if (options.mode === 'tunnel' && options.provider === 'expo-ws') env.EXPO_UNSTABLE_TUNNEL_V2 = '1';
    else delete env.EXPO_UNSTABLE_TUNNEL_V2;

    this.log(
      `Starting Expo (${options.mode === 'tunnel' ? `tunnel via ${options.provider}` : 'LAN'}, ${options.bundleMode}${
        options.compress ? ', compressed bundles' : ''
      }${clearCache ? ', clearing Metro cache' : ''})${attempt > 1 ? ` — attempt ${attempt}/${MAX_START_ATTEMPTS}` : ''}`,
      'system'
    );
    this.log(`> expo ${args.slice(1).join(' ')}`, 'system');

    const child = spawn(process.execPath, args, {
      cwd: this.projectRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: !sys.IS_WIN,
    });
    this.child = child;
    this.lineBuffers = { stdout: '', stderr: '' };
    this.setState({ pid: child.pid, startedAt: Date.now(), phase: 'Starting Metro bundler' });

    child.stdout.on('data', (chunk) => this.onOutput('stdout', chunk));
    child.stderr.on('data', (chunk) => this.onOutput('stderr', chunk));
    child.on('error', (error) => this.log(`Failed to launch Expo: ${error.message}`, 'system', 'error'));
    child.on('exit', (code, signal) => this.onExit(child, runId, code, signal, { attempt, input }));

    this.waitUntilReady(runId).catch((error) => this.log(`Readiness check failed: ${error.message}`, 'system', 'error'));
    return this.getState();
  }

  async stopNow(reason) {
    this.runId++;
    this.stopRunTimers();
    const child = this.child;
    if (!child) {
      if (this.state.status !== 'stopped') this.setState({ status: 'stopped', phase: null, error: null });
      return this.getState();
    }
    this.log(`${reason || 'Stopping'}…`, 'system');
    this.setState({ status: 'stopping', phase: 'Stopping server and tunnel' });
    child.expectedExit = true;
    await sys.killTree(child.pid);
    // Wait for the exit event so state is consistent before a restart.
    const exited = child.exitCode !== null || child.signalCode !== null;
    if (this.child === child && !exited) {
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 5000);
        child.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    this.child = null;
    this.resetRuntimeState('stopped');
    return this.getState();
  }

  resetRuntimeState(status, extra = {}) {
    this.setState({
      status,
      phase: null,
      pid: null,
      readyAt: null,
      metroUp: false,
      activeOptions: null,
      urls: { ...this.state.urls, expoGo: null, tunnel: null, lan: null },
      tunnel: { status: 'idle', url: null, since: null },
      health: { ...this.state.health, status: 'unknown', failures: 0 },
      devices: [],
      ...extra,
    });
  }

  onExit(child, runId, code, signal, { attempt, input }) {
    this.flushOutput();
    if (this.child === child) this.child = null;
    const exit = { code, signal, at: Date.now() };
    this.setState({ lastExit: exit });
    if (child.expectedExit || runId !== this.runId) return;

    this.runId++;
    this.stopRunTimers();
    const wasRunning = this.state.status === 'running';
    const lastError = this.recentErrors[this.recentErrors.length - 1] || null;
    const tunnelFailure = this.recentOutput.some((line) => TUNNEL_FAILURE.test(line));
    this.log(`Expo exited unexpectedly (code ${code ?? 'none'}${signal ? `, ${signal}` : ''}).`, 'system', 'error');

    // Tunnel handshakes fail intermittently; retrying usually succeeds.
    if (!wasRunning && tunnelFailure && attempt < MAX_START_ATTEMPTS && this.options.mode === 'tunnel') {
      this.resetRuntimeState('starting', { phase: 'Retrying tunnel connection' });
      const retryRun = this.runId;
      setTimeout(() => {
        if (retryRun !== this.runId) return; // stopped or restarted meanwhile
        this.enqueue(() => this.startNow({ ...input, clearCache: false }, { attempt: attempt + 1 })).catch(() => {});
      }, 5000 * attempt); // back off: tunnel services rate-limit rapid reconnects
      return;
    }

    if (wasRunning && this.options.autoRecover && this.tryRecover('Expo process exited')) return;

    this.resetRuntimeState('error', {
      error: {
        code: tunnelFailure ? 'TUNNEL_FAILED' : 'EXITED',
        message: lastError
          ? lastError.replace(/^CommandError:\s*/, '').replace(/^\w/, (c) => c.toUpperCase())
          : `Expo exited with code ${code ?? 'unknown'}.`,
        hint: tunnelFailure
          ? this.options.provider === 'ngrok'
            ? 'The ngrok tunnel could not connect. Check your internet connection (https://status.ngrok.com) or switch the tunnel provider to "Expo WS" and start again.'
            : 'The Expo WS tunnel could not connect. Make sure you are logged in ("npx expo login") or switch back to ngrok.'
          : 'Check the logs below for the cause, then start again.',
      },
    });
  }

  // ------------------------------------------------------------ output

  onOutput(stream, chunk) {
    const text = this.lineBuffers[stream] + chunk.toString('utf8');
    const lines = text.split(/\r?\n|\r/);
    this.lineBuffers[stream] = lines.pop();
    for (const line of lines) this.onLine(stream, line);
  }

  flushOutput() {
    for (const stream of ['stdout', 'stderr']) {
      if (this.lineBuffers[stream]) this.onLine(stream, this.lineBuffers[stream]);
      this.lineBuffers[stream] = '';
    }
  }

  onLine(stream, raw) {
    const line = raw.replace(ANSI_PATTERN, '').trimEnd();
    if (!line.trim()) return;

    if (line.startsWith(REPORT_MARKER)) {
      try {
        this.onBundleReport(JSON.parse(line.slice(REPORT_MARKER.length)));
      } catch (_) {
        // malformed report line; ignore
      }
      return;
    }

    const tunnelUrl = line.match(/Tunnel URL:\s*(https?:\/\/\S+)/i);
    if (tunnelUrl) this.onTunnelUrl(tunnelUrl[1]);

    if (/Tunnel connection has been closed/i.test(line)) this.onTunnelLost();
    if (/Tunnel connected\./i.test(line) && this.state.tunnel.status === 'down') {
      this.setState({ tunnel: { ...this.state.tunnel, status: 'connected', since: Date.now() } });
    }
    if (/Waiting on\s+http/i.test(line) && this.state.status === 'starting') {
      this.setState({ phase: this.options.mode === 'tunnel' ? 'Connecting tunnel' : 'Bundler ready' });
    }

    const level = /Tunnel URL:/i.test(line) ? 'info' : undefined;
    this.log(line, stream, level);
  }

  onTunnelUrl(rawUrl) {
    let url;
    try {
      url = new URL(rawUrl);
    } catch (_) {
      return;
    }
    const https = `https://${url.host}`;
    if (this.state.urls.tunnel === https) return;
    this.setState({
      urls: { ...this.state.urls, tunnel: https, expoGo: `exp://${url.host}` },
      tunnel: { status: 'connected', url: https, since: Date.now() },
      phase: this.state.status === 'starting' ? 'Verifying tunnel' : this.state.phase,
    });
  }

  onTunnelLost() {
    this.setState({ tunnel: { ...this.state.tunnel, status: 'down' } });
    if (this.state.status === 'running') {
      this.log('Tunnel dropped; checking whether it reconnects…', 'system', 'warn');
      setTimeout(() => this.checkHealth(this.runId), 3000);
    }
  }

  onBundleReport(report) {
    const bundles = [report, ...this.state.bundles].slice(0, BUNDLE_HISTORY_LIMIT);
    this.setState({ bundles });
    if (report.kind !== 'bundle') return;
    const saved = report.rawBytes && report.sentBytes < report.rawBytes
      ? ` → ${formatBytes(report.sentBytes)} ${report.encoding}`
      : '';
    this.log(
      `${report.prewarm ? 'Pre-built' : 'Served'} ${report.platform} bundle ${formatBytes(report.rawBytes)}${saved} in ${(report.ms / 1000).toFixed(1)}s${
        report.viaTunnel ? ' via tunnel' : ''
      }`,
      'system'
    );
  }

  // ------------------------------------------------------------ readiness

  async waitUntilReady(runId) {
    const deadline = Date.now() + START_TIMEOUT_MS;
    let metroUpAt = null;
    while (runId === this.runId && this.child) {
      if (Date.now() > deadline) {
        this.log('Timed out waiting for the Expo server to become reachable.', 'system', 'error');
        await this.stopNow('Giving up');
        this.setState({
          status: 'error',
          error: {
            code: 'START_TIMEOUT',
            message: 'Expo did not become reachable within 5 minutes.',
            hint: 'Check the logs for errors. A slow first start can happen after clearing the cache — try again.',
          },
        });
        return;
      }

      if (!this.state.metroUp) {
        const status = await sys.request(`${LOCAL_URL}/status`, { timeoutMs: 2000 }).catch(() => null);
        if (runId !== this.runId) return;
        if (status && /packager-status:running/.test(status.body)) {
          metroUpAt = Date.now();
          const lanHost = sys.getLanAddress();
          this.setState({
            metroUp: true,
            urls: {
              ...this.state.urls,
              lan: lanHost ? `exp://${lanHost}:${METRO_PORT}` : null,
              expoGo: this.options.mode === 'lan' && lanHost ? `exp://${lanHost}:${METRO_PORT}` : this.state.urls.expoGo,
            },
            phase: this.options.mode === 'tunnel' ? (this.state.urls.tunnel ? 'Verifying tunnel' : 'Connecting tunnel') : 'Bundler ready',
          });
        }
      }

      if (this.state.metroUp) {
        if (this.options.mode === 'lan') {
          this.markReady(runId);
          return;
        }
        if (!this.state.urls.tunnel && metroUpAt && Date.now() - metroUpAt > 4000) {
          const discovered = await this.discoverNgrokUrl();
          if (discovered) this.onTunnelUrl(discovered);
        }
        if (this.state.urls.tunnel) {
          const probe = await sys.request(`${this.state.urls.tunnel}/status`, { timeoutMs: 10000 }).catch(() => null);
          if (runId !== this.runId) return;
          if (probe && /packager-status:running/.test(probe.body)) {
            this.recordHealth({ localMs: null, tunnelMs: probe.ms, ok: true });
            this.markReady(runId);
            return;
          }
        }
      }
      await sys.delay(1000);
    }
  }

  /** Fallback when the URL was not printed: ask ngrok's local agent API. */
  async discoverNgrokUrl() {
    for (let port = 4040; port <= 4049; port++) {
      const res = await sys.request(`http://127.0.0.1:${port}/api/tunnels`, { timeoutMs: 800 }).catch(() => null);
      if (!res || res.status !== 200) continue;
      try {
        const { tunnels = [] } = JSON.parse(res.body);
        const match = tunnels.find((t) => String(t.config && t.config.addr).endsWith(`:${METRO_PORT}`) && /^https:/.test(t.public_url))
          || tunnels.find((t) => String(t.config && t.config.addr).endsWith(`:${METRO_PORT}`));
        if (match) return match.public_url;
      } catch (_) {
        // not an ngrok agent
      }
    }
    return null;
  }

  markReady(runId) {
    if (runId !== this.runId) return;
    this.setState({ status: 'running', phase: 'Ready', readyAt: Date.now(), error: null, portBusy: null });
    this.log(`Ready — open ${this.state.urls.expoGo} in Expo Go`, 'system');
    if (this.options.mode === 'tunnel' && this.options.provider === 'ngrok') this.rememberStableUrl();
    this.timers.health = setInterval(() => this.checkHealth(runId), HEALTH_INTERVAL_MS);
    this.connectDeviceSocket(runId);
    if (this.options.prewarm) this.prewarm(runId);
  }

  // ------------------------------------------------------------ health

  recordHealth({ localMs, tunnelMs, ok }) {
    const previous = this.state.health;
    const failures = ok ? 0 : previous.failures + 1;
    const latencyMs = this.options.mode === 'tunnel' ? tunnelMs : localMs;
    let status = 'healthy';
    if (!ok) status = failures >= FAILS_BEFORE_DOWN ? 'down' : 'degraded';
    else if (latencyMs != null && latencyMs > SLOW_LATENCY_MS) status = 'degraded';
    const history = [...previous.history, { t: Date.now(), ms: ok ? latencyMs : null }].slice(-HISTORY_LIMIT);
    this.setState({
      health: { status, latencyMs: ok ? latencyMs : null, localMs, checkedAt: Date.now(), failures, history },
    });
    return status;
  }

  async checkHealth(runId) {
    if (runId !== this.runId || this.state.status !== 'running' || this.checkingHealth) return;
    this.checkingHealth = true;
    try {
      const local = await sys.request(`${LOCAL_URL}/status`, { timeoutMs: 3000 }).catch(() => null);
      const localOk = Boolean(local && /packager-status:running/.test(local.body));
      let tunnelOk = true;
      let tunnelMs = null;
      if (this.options.mode === 'tunnel' && this.state.urls.tunnel) {
        const remote = await sys.request(`${this.state.urls.tunnel}/status`, { timeoutMs: 8000 }).catch(() => null);
        tunnelOk = Boolean(remote && /packager-status:running/.test(remote.body));
        tunnelMs = remote ? remote.ms : null;
      }
      if (runId !== this.runId) return;
      const ok = localOk && tunnelOk;
      if (this.options.mode === 'tunnel') {
        const tunnelStatus = tunnelOk ? 'connected' : 'down';
        if (tunnelStatus !== this.state.tunnel.status) {
          this.setState({ tunnel: { ...this.state.tunnel, status: tunnelStatus, since: Date.now() } });
        }
      }
      const status = this.recordHealth({ localMs: local ? local.ms : null, tunnelMs, ok });
      if (status === 'down' && this.options.autoRecover) {
        this.tryRecover(localOk ? 'Tunnel is unreachable' : 'Metro stopped responding');
      }
    } finally {
      this.checkingHealth = false;
    }
  }

  tryRecover(reason) {
    const now = Date.now();
    this.recoveries = this.recoveries.filter((t) => now - t < RECOVERY_WINDOW_MS);
    if (this.recoveries.length >= RECOVERY_MAX) {
      this.log(`Auto-recovery paused: ${RECOVERY_MAX} restarts in the last 10 minutes. Restart manually when the network is stable.`, 'system', 'warn');
      return false;
    }
    this.recoveries.push(now);
    this.log(`Auto-recovering (${reason}) — restarting Expo…`, 'system', 'warn');
    this.restart({}).catch((error) => this.log(`Auto-recovery failed: ${error.message}`, 'system', 'error'));
    return true;
  }

  // ------------------------------------------------------------ prewarm

  /**
   * Build the exact iOS bundle Expo Go will request, before the phone asks for
   * it. Metro caches the module graph, so the phone only waits for the
   * (compressed) download instead of a full cold build through the tunnel.
   */
  async prewarm(runId = this.runId) {
    if (!this.state.metroUp) throw new HttpError(409, 'The Expo server is not running.', 'NOT_RUNNING');
    if (this.state.prewarm.status === 'running') return;
    this.setState({ prewarm: { status: 'running', ms: null, bytes: null, error: null, at: Date.now() } });
    try {
      const manifestRes = await sys.request(`${LOCAL_URL}/`, {
        headers: { 'expo-platform': 'ios', accept: 'application/expo+json,application/json' },
        timeoutMs: 60000,
      });
      const body = manifestRes.body;
      const json = body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1);
      const manifest = JSON.parse(json);
      const bundleUrl = (manifest.launchAsset && manifest.launchAsset.url) || manifest.bundleUrl;
      if (!bundleUrl) throw new Error('The manifest did not include a bundle URL.');
      const local = new URL(bundleUrl);
      const target = `${LOCAL_URL}${local.pathname}${local.search}`;
      this.log('Pre-building the iOS bundle so Expo Go loads faster…', 'system');
      const res = await sys.request(target, {
        headers: { 'expo-platform': 'ios', 'x-expo-control-prewarm': '1', accept: 'application/javascript' },
        timeoutMs: 10 * 60 * 1000,
        discardBody: true,
      });
      if (runId !== this.runId) return;
      if (res.status >= 400) throw new Error(`Metro answered ${res.status} (the bundle has an error — see logs).`);
      this.setState({ prewarm: { status: 'done', ms: res.ms, bytes: res.bytes, error: null, at: Date.now() } });
    } catch (error) {
      if (runId !== this.runId) return;
      this.log(`Pre-build failed: ${error.message}`, 'system', 'warn');
      this.setState({ prewarm: { status: 'failed', ms: null, bytes: null, error: error.message, at: Date.now() } });
    }
  }

  // ------------------------------------------------------------ devices

  connectDeviceSocket(runId) {
    if (!WebSocketImpl || runId !== this.runId) return;
    this.closeDeviceSocket();
    let socket;
    try {
      socket = new WebSocketImpl(`ws://127.0.0.1:${METRO_PORT}/message`);
    } catch (_) {
      return;
    }
    this.deviceSocket = socket;
    let requestId = 0;
    const poll = () => {
      if (socket.readyState === 1) socket.send(JSON.stringify({ version: 2, id: `peers-${++requestId}`, method: 'getpeers', target: 'server' }));
    };
    const onMessage = (data) => {
      let message;
      try {
        message = JSON.parse(String(data && data.data !== undefined ? data.data : data));
      } catch (_) {
        return;
      }
      if (!message || typeof message.id !== 'string' || !message.id.startsWith('peers-') || !message.result) return;
      const devices = Object.entries(message.result)
        .map(([id, query]) => ({ id, ...parsePeerQuery(query) }))
        .filter((peer) => peer.device || peer.app || peer.name)
        .map((peer) => ({ id: peer.id, name: peer.device || peer.name || 'Device', app: peer.app || null }));
      if (JSON.stringify(devices) !== JSON.stringify(this.state.devices)) this.setState({ devices });
    };
    const on = (event, handler) => (socket.on ? socket.on(event, handler) : socket.addEventListener(event, handler));
    on('open', () => {
      poll();
      this.timers.devices = setInterval(poll, DEVICE_POLL_MS);
    });
    on('message', onMessage);
    on('error', () => {});
    on('close', () => {
      clearInterval(this.timers.devices);
      if (this.deviceSocket === socket && runId === this.runId && this.state.status === 'running') {
        this.timers.deviceReconnect = setTimeout(() => this.connectDeviceSocket(runId), 3000);
      }
    });
  }

  closeDeviceSocket() {
    clearInterval(this.timers.devices);
    clearTimeout(this.timers.deviceReconnect);
    if (this.deviceSocket) {
      const socket = this.deviceSocket;
      this.deviceSocket = null;
      try {
        socket.close();
      } catch (_) {
        // already closed
      }
    }
  }

  /** Broadcast a dev command (reload / devMenu) to every connected app. */
  sendToApps(method) {
    if (!['reload', 'devMenu'].includes(method)) throw new HttpError(400, `Unsupported command: ${method}`, 'BAD_COMMAND');
    const socket = this.deviceSocket;
    if (!socket || socket.readyState !== 1) throw new HttpError(409, 'The Expo server is not running.', 'NOT_RUNNING');
    if (!this.state.devices.length) throw new HttpError(409, 'No app is connected. Open the project in Expo Go first.', 'NO_DEVICES');
    socket.send(JSON.stringify({ version: 2, method }));
    this.log(method === 'reload' ? 'Sent reload to connected apps' : 'Opened the dev menu on connected apps', 'system');
    return { sent: this.state.devices.length };
  }

  // ------------------------------------------------------------ port

  async inspectPort() {
    if (!(await sys.isPortInUse(METRO_PORT))) {
      if (this.state.portBusy) this.setState({ portBusy: null });
      return null;
    }
    const pid = await sys.findPidOnPort(METRO_PORT);
    const name = await sys.getProcessName(pid);
    const portBusy = { pid, name, port: METRO_PORT };
    if (JSON.stringify(portBusy) !== JSON.stringify(this.state.portBusy)) this.setState({ portBusy });
    return portBusy;
  }

  /** Stop whatever process is holding the Metro port (user-initiated). */
  freePort() {
    return this.enqueue(async () => {
      if (this.child) return this.stopNow('Freeing the port');
      const busy = await this.inspectPort();
      if (!busy) return this.getState();
      if (!busy.pid) throw new HttpError(409, `Could not find the process using port ${METRO_PORT}.`, 'PID_UNKNOWN');
      this.log(`Stopping ${busy.name || 'process'} (PID ${busy.pid}) that holds port ${METRO_PORT}…`, 'system', 'warn');
      await sys.killTree(busy.pid);
      await this.inspectPort();
      if (this.state.status === 'error' && this.state.error && this.state.error.code === 'PORT_IN_USE') {
        this.setState({ status: 'stopped', error: null });
      }
      return this.getState();
    });
  }

  startIdleWatch() {
    const tick = () => {
      if (!this.child && ['stopped', 'error'].includes(this.state.status)) this.inspectPort().catch(() => {});
    };
    tick();
    this.timers.idle = setInterval(tick, IDLE_PORT_CHECK_MS);
    if (this.timers.idle.unref) this.timers.idle.unref();
  }

  stopRunTimers() {
    clearInterval(this.timers.health);
    this.closeDeviceSocket();
  }

  async shutdown() {
    clearInterval(this.timers.idle);
    this.stopRunTimers();
    if (this.child) {
      this.child.expectedExit = true;
      await sys.killTree(this.child.pid);
    }
  }
}

module.exports = { ExpoController, HttpError, DEFAULT_OPTIONS, METRO_PORT };
