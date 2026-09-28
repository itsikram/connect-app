'use strict';

/**
 * OS helpers for the Expo control daemon: ports, processes, network and HTTP
 * probes. Works on Windows (the main dev machine) and macOS/Linux.
 */

const { execFile } = require('child_process');
const net = require('net');
const os = require('os');
const http = require('http');
const https = require('https');

const IS_WIN = process.platform === 'win32';

function run(cmd, args, options = {}) {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { windowsHide: true, timeout: 15000, maxBuffer: 8 * 1024 * 1024, ...options },
      (error, stdout, stderr) => {
        resolve({
          code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
          stdout: String(stdout || ''),
          stderr: String(stderr || ''),
        });
      }
    );
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** True when something accepts TCP connections on the port. */
function isPortInUse(port, host = '127.0.0.1', timeoutMs = 700) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (inUse) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(inUse);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/** PID of the process listening on a TCP port, or null. */
async function findPidOnPort(port) {
  if (IS_WIN) {
    const { stdout } = await run('netstat', ['-ano']);
    for (const line of stdout.split(/\r?\n/)) {
      const match = line.match(/^\s*TCP\s+(\S+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
      if (match && match[1].endsWith(`:${port}`)) {
        const pid = Number(match[2]);
        if (pid > 0) return pid;
      }
    }
    return null;
  }
  const { stdout } = await run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']);
  const pid = Number(stdout.split(/\s+/).find(Boolean));
  return pid > 0 ? pid : null;
}

async function getProcessName(pid) {
  if (!pid) return null;
  if (IS_WIN) {
    const { stdout } = await run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']);
    const match = stdout.match(/^"([^"]+)"/m);
    return match ? match[1] : null;
  }
  const { stdout } = await run('ps', ['-p', String(pid), '-o', 'comm=']);
  return stdout.trim() || null;
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

/**
 * Kill a process and all of its children (Expo spawns ngrok as a child, which
 * would otherwise keep the tunnel hostname reserved).
 */
async function killTree(pid, { graceMs = 4000 } = {}) {
  if (!pid || !isAlive(pid)) return;
  if (IS_WIN) {
    await run('taskkill', ['/PID', String(pid), '/T', '/F']);
  } else {
    const signal = (sig) => {
      try {
        process.kill(-pid, sig); // whole process group (child is spawned detached)
      } catch (_) {
        try {
          process.kill(pid, sig);
        } catch (__) {
          // already gone
        }
      }
    };
    signal('SIGTERM');
    const deadline = Date.now() + graceMs;
    while (isAlive(pid) && Date.now() < deadline) await delay(150);
    if (isAlive(pid)) signal('SIGKILL');
  }
  const deadline = Date.now() + 3000;
  while (isAlive(pid) && Date.now() < deadline) await delay(100);
}

const VIRTUAL_ADAPTER = /vEthernet|virtualbox|vmware|vbox|wsl|hyper-v|docker|utun|tailscale|zerotier|loopback|bridge/i;

function privateRank(address) {
  if (address.startsWith('192.168.')) return 0;
  if (address.startsWith('10.')) return 1;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) return 2;
  return 3;
}

/** Best guess at the machine's LAN IPv4 address (the one a phone on Wi-Fi can reach). */
function getLanAddress() {
  const candidates = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries || []) {
      const isV4 = entry.family === 'IPv4' || entry.family === 4;
      if (!isV4 || entry.internal) continue;
      candidates.push({ address: entry.address, virtual: VIRTUAL_ADAPTER.test(name) });
    }
  }
  candidates.sort(
    (a, b) => Number(a.virtual) - Number(b.virtual) || privateRank(a.address) - privateRank(b.address)
  );
  return candidates[0] ? candidates[0].address : null;
}

function isPrivateAddress(address = '') {
  const ip = address.replace(/^::ffff:/, '');
  return (
    ip === '::1' ||
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^f[cd][0-9a-f]{2}:/i.test(ip) || // IPv6 unique local
    /^fe80:/i.test(ip) // IPv6 link local
  );
}

/**
 * Minimal HTTP(S) request helper with a hard timeout.
 * `discardBody` streams the body away while still counting bytes (used to
 * pre-build large bundles without holding them in memory).
 */
function request(url, { method = 'GET', headers = {}, timeoutMs = 8000, discardBody = false, maxBytes = 2 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    let target;
    try {
      target = new URL(url);
    } catch (error) {
      reject(error);
      return;
    }
    const client = target.protocol === 'https:' ? https : http;
    const req = client.request(
      target,
      { method, headers: { 'user-agent': 'expo-control', ...headers } },
      (res) => {
        const chunks = [];
        let bytes = 0;
        res.on('data', (chunk) => {
          bytes += chunk.length;
          if (!discardBody && bytes <= maxBytes) chunks.push(chunk);
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: discardBody ? '' : Buffer.concat(chunks).toString('utf8'),
            bytes,
            ms: Date.now() - started,
          });
        });
        res.on('error', reject);
      }
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timed out after ${timeoutMs}ms`)));
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  IS_WIN,
  run,
  delay,
  isPortInUse,
  findPidOnPort,
  getProcessName,
  isAlive,
  killTree,
  getLanAddress,
  isPrivateAddress,
  request,
};
