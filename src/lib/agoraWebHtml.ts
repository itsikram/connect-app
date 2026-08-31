/**
 * Agora Web SDK page loaded inside a WebView so Expo Go (no native Agora)
 * can join the same channels as the web app.
 */
export const AGORA_WEB_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; media-src * blob: mediastream:" />
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #0b0f17; overflow: hidden; }
    #remote { position: absolute; inset: 0; background: #0b0f17; }
    #local {
      position: absolute; width: 28%; height: 22%; bottom: 16px; right: 12px;
      border-radius: 12px; overflow: hidden; z-index: 2; background: #111;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }
    #local.hidden, #remote.audio-only { display: none; }
    video { object-fit: cover; width: 100%; height: 100%; }
  </style>
  <script src="https://download.agora.io/sdk/release/AgoraRTC_N-4.24.0.js"></script>
</head>
<body>
  <div id="remote"></div>
  <div id="local"></div>
  <script>
    (function () {
      var RN = window.ReactNativeWebView;
      function post(msg) {
        try { RN && RN.postMessage(JSON.stringify(msg)); } catch (e) {}
      }

      var client = null;
      var localTracks = [];
      var joining = false;
      var facingMode = 'user';

      function setAudioOnlyUi(isAudio) {
        var remote = document.getElementById('remote');
        var local = document.getElementById('local');
        if (isAudio) {
          remote.classList.add('audio-only');
          local.classList.add('hidden');
        } else {
          remote.classList.remove('audio-only');
          local.classList.remove('hidden');
        }
      }

      async function stopTracks() {
        for (var i = 0; i < localTracks.length; i++) {
          try { localTracks[i].stop && localTracks[i].stop(); } catch (e) {}
          try { await localTracks[i].close(); } catch (e) {}
        }
        localTracks = [];
      }

      async function leave() {
        joining = false;
        try {
          if (client) {
            try { await client.unpublish(localTracks); } catch (e) {}
            try { await client.leave(); } catch (e) {}
            try { client.removeAllListeners(); } catch (e) {}
          }
        } catch (e) {}
        await stopTracks();
        client = null;
        var remote = document.getElementById('remote');
        if (remote) remote.innerHTML = '';
        post({ type: 'left' });
      }

      async function createLocalTracks(isAudio) {
        await stopTracks();
        if (isAudio) {
          localTracks = [await AgoraRTC.createMicrophoneAudioTrack()];
          return;
        }
        try {
          localTracks = await AgoraRTC.createMicrophoneAndCameraTracks(
            {},
            { facingMode: facingMode, encoderConfig: '720p_1' }
          );
        } catch (e) {
          post({ type: 'log', message: 'camera failed, mic only: ' + (e && e.message) });
          localTracks = [await AgoraRTC.createMicrophoneAudioTrack()];
        }
        var videoTrack = localTracks.find(function (t) { return t.trackMediaType === 'video'; });
        if (videoTrack) {
          videoTrack.play('local', { fit: 'cover' });
        }
      }

      function bindClientEvents(c) {
        c.on('user-published', async function (user, mediaType) {
          try {
            await c.subscribe(user, mediaType);
            if (mediaType === 'audio' && user.audioTrack) {
              user.audioTrack.play();
            }
            if (mediaType === 'video' && user.videoTrack) {
              user.videoTrack.play('remote', { fit: 'cover' });
            }
            post({ type: 'user-published', uid: user.uid, mediaType: mediaType });
          } catch (e) {
            post({ type: 'error', message: 'subscribe failed: ' + (e && e.message) });
          }
        });
        c.on('user-unpublished', function (user, mediaType) {
          post({ type: 'user-unpublished', uid: user.uid, mediaType: mediaType });
        });
        c.on('user-left', function (user) {
          post({ type: 'user-left', uid: user.uid });
        });
        c.on('network-quality', function (stats) {
          post({
            type: 'network-quality',
            uplink: (stats && stats.uplinkNetworkQuality) || 0,
            downlink: (stats && stats.downlinkNetworkQuality) || 0,
          });
        });
      }

      async function join(payload) {
        if (joining) return;
        joining = true;
        var appId = payload.appId;
        var token = payload.token;
        var channelName = payload.channelName;
        var uid = payload.uid;
        var isAudio = !!payload.isAudio;
        setAudioOnlyUi(isAudio);

        try {
          if (client) {
            try { await client.leave(); } catch (e) {}
            try { client.removeAllListeners(); } catch (e) {}
            client = null;
          }

          client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
          bindClientEvents(client);
          await client.join(appId, channelName, token, uid);

          try {
            if (!localTracks.length) {
              await createLocalTracks(isAudio);
            }
            if (localTracks.length) {
              await client.publish(localTracks);
            }
          } catch (micErr) {
            post({ type: 'log', message: 'mic publish failed (receive-only): ' + (micErr && micErr.message) });
            await stopTracks();
          }

          var remotes = client.remoteUsers || [];
          for (var i = 0; i < remotes.length; i++) {
            var user = remotes[i];
            if (user.hasAudio) {
              await client.subscribe(user, 'audio');
              if (user.audioTrack) user.audioTrack.play();
            }
            if (!isAudio && user.hasVideo) {
              await client.subscribe(user, 'video');
              if (user.videoTrack) user.videoTrack.play('remote', { fit: 'cover' });
            }
          }

          joining = false;
          post({ type: 'joined' });
        } catch (e) {
          joining = false;
          post({ type: 'error', message: 'join failed: ' + (e && e.message) });
        }
      }

      async function preview(payload) {
        try {
          setAudioOnlyUi(!!payload.isAudio);
          await createLocalTracks(!!payload.isAudio);
          post({ type: 'preview-ready' });
        } catch (e) {
          post({ type: 'error', message: 'preview failed: ' + (e && e.message) });
        }
      }

      async function muteAudio(muted) {
        var track = localTracks.find(function (t) { return t.trackMediaType === 'audio'; });
        if (track) {
          try { await track.setEnabled(!muted); } catch (e) {}
        }
      }

      async function muteVideo(muted) {
        var track = localTracks.find(function (t) { return t.trackMediaType === 'video'; });
        if (track) {
          try { await track.setEnabled(!muted); } catch (e) {}
        }
      }

      async function switchCamera() {
        facingMode = facingMode === 'user' ? 'environment' : 'user';
        var oldVideo = localTracks.find(function (t) { return t.trackMediaType === 'video'; });
        try {
          var next = await AgoraRTC.createCameraVideoTrack({ facingMode: facingMode, encoderConfig: '720p_1' });
          if (client && oldVideo) {
            await client.unpublish(oldVideo);
          }
          if (oldVideo) {
            try { oldVideo.stop(); } catch (e) {}
            try { await oldVideo.close(); } catch (e) {}
          }
          localTracks = localTracks.filter(function (t) { return t.trackMediaType !== 'video'; });
          localTracks.push(next);
          next.play('local', { fit: 'cover' });
          if (client) await client.publish(next);
        } catch (e) {
          post({ type: 'error', message: 'switch camera failed: ' + (e && e.message) });
        }
      }

      window.__agoraHandle = async function (cmd) {
        if (!cmd || !cmd.type) return;
        try {
          if (cmd.type === 'join') await join(cmd);
          else if (cmd.type === 'preview') await preview(cmd);
          else if (cmd.type === 'leave') await leave();
          else if (cmd.type === 'muteAudio') await muteAudio(!!cmd.muted);
          else if (cmd.type === 'muteVideo') await muteVideo(!!cmd.muted);
          else if (cmd.type === 'switchCamera') await switchCamera();
        } catch (e) {
          post({ type: 'error', message: String(e && e.message || e) });
        }
      };

      function onNativeMessage(event) {
        try {
          var data = event && event.data;
          if (typeof data === 'string') data = JSON.parse(data);
          if (data && data.type) window.__agoraHandle(data);
        } catch (e) {}
      }
      window.addEventListener('message', onNativeMessage);
      document.addEventListener('message', onNativeMessage);

      function waitForSdk() {
        if (window.AgoraRTC) {
          post({ type: 'ready' });
          return;
        }
        setTimeout(waitForSdk, 80);
      }
      waitForSdk();
    })();
  </script>
</body>
</html>`;
