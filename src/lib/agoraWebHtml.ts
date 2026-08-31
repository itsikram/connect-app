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
      position: absolute; width: 28%; height: 22%; min-width: 96px; min-height: 128px;
      max-width: 148px; max-height: 198px; bottom: 110px; right: 12px; left: auto; top: auto;
      border-radius: 12px; overflow: hidden; z-index: 2; background: #111;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4); border: 1.5px solid rgba(255,255,255,0.28);
      touch-action: none; user-select: none; -webkit-user-select: none;
      will-change: transform; cursor: grab;
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
      var joinedChannel = '';
      var joinedUid = null;

      function playAllRemoteAudio() {
        if (!client) return;
        var remotes = client.remoteUsers || [];
        for (var i = 0; i < remotes.length; i++) {
          var user = remotes[i];
          try {
            if (user.audioTrack) user.audioTrack.play();
          } catch (e) {}
        }
      }

      function tryResumeAudio() {
        try {
          if (typeof AgoraRTC !== 'undefined') {
            AgoraRTC.onAudioAutoplayFailed = function () {
              post({ type: 'log', message: 'audio autoplay failed, retrying remote play' });
              playAllRemoteAudio();
            };
          }
        } catch (e) {}
      }

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
          }
        } catch (e) {}
        await stopTracks();
        joinedChannel = '';
        joinedUid = null;
        var remote = document.getElementById('remote');
        if (remote) remote.innerHTML = '';
        post({ type: 'left' });
      }

      async function createLocalTracks(isAudio) {
        var hasAudio = localTracks.some(function (t) { return t.trackMediaType === 'audio'; });
        var hasVideo = localTracks.some(function (t) { return t.trackMediaType === 'video'; });
        if (isAudio && hasAudio) return;
        if (!isAudio && hasAudio && hasVideo) return;
        await stopTracks();
        if (isAudio) {
          localTracks = [await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true })];
          return;
        }
        try {
          localTracks = await AgoraRTC.createMicrophoneAndCameraTracks(
            { AEC: true, ANS: true },
            { facingMode: facingMode, encoderConfig: '480p_1' }
          );
        } catch (e) {
          post({ type: 'log', message: 'camera failed, mic only: ' + (e && e.message) });
          localTracks = [await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true })];
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
        var appId = payload.appId;
        var token = payload.token;
        var channelName = payload.channelName;
        var uid = payload.uid;
        var isAudio = !!payload.isAudio;
        setAudioOnlyUi(isAudio);

        if (client && joinedChannel === channelName && joinedUid === uid) {
          try {
            if (localTracks.length) await client.publish(localTracks);
          } catch (e) {}
          post({ type: 'joined' });
          return;
        }

        if (joining) return;
        joining = true;

        try {
          if (client && joinedChannel) {
            try { await client.unpublish(localTracks); } catch (e) {}
            try { await client.leave(); } catch (e) {}
            joinedChannel = '';
            joinedUid = null;
          }

          if (!client) {
            client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            bindClientEvents(client);
          }
          var tracksPromise = localTracks.length ? Promise.resolve() : createLocalTracks(isAudio);
          await client.join(appId, channelName, token, uid);
          joinedChannel = channelName;
          joinedUid = uid;
          tryResumeAudio();
          post({ type: 'joined' });

          try {
            await tracksPromise;
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
            try {
              if (user.hasAudio) {
                await client.subscribe(user, 'audio');
                if (user.audioTrack) user.audioTrack.play();
              }
              if (!isAudio && user.hasVideo) {
                await client.subscribe(user, 'video');
                if (user.videoTrack) user.videoTrack.play('remote', { fit: 'cover' });
              }
            } catch (subErr) {
              post({ type: 'log', message: 'existing remote subscribe failed: ' + (subErr && subErr.message) });
            }
          }
          playAllRemoteAudio();
          joining = false;
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
          var next = await AgoraRTC.createCameraVideoTrack({ facingMode: facingMode, encoderConfig: '480p_1' });
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

      function enableLocalPreviewDrag() {
        var el = document.getElementById('local');
        if (!el || el.getAttribute('data-drag-ready')) return;
        el.setAttribute('data-drag-ready', '1');

        var dragging = false;
        var pointerId = null;
        var startX = 0;
        var startY = 0;
        var originLeft = 0;
        var originTop = 0;
        var pad = 10;
        var bottomReserve = 108;
        var raf = 0;
        var nextLeft = 0;
        var nextTop = 0;

        function clamp(left, top) {
          var w = el.offsetWidth;
          var h = el.offsetHeight;
          var vw = window.innerWidth || document.documentElement.clientWidth;
          var vh = window.innerHeight || document.documentElement.clientHeight;
          var maxL = Math.max(pad, vw - w - pad);
          var maxT = Math.max(pad, vh - h - bottomReserve);
          return {
            left: Math.min(maxL, Math.max(pad, left)),
            top: Math.min(maxT, Math.max(pad, top)),
          };
        }

        function commit(left, top) {
          el.style.left = left + 'px';
          el.style.top = top + 'px';
          el.style.right = 'auto';
          el.style.bottom = 'auto';
          el.style.transform = 'translate3d(0,0,0)';
        }

        function tick() {
          raf = 0;
          if (!dragging) return;
          el.style.transform = 'translate3d(' + nextLeft + 'px,' + nextTop + 'px,0)';
        }

        function onDown(e) {
          if (el.classList.contains('hidden')) return;
          var t = e.touches ? e.touches[0] : e;
          if (!t) return;
          dragging = true;
          pointerId = e.pointerId;
          startX = t.clientX;
          startY = t.clientY;
          var rect = el.getBoundingClientRect();
          originLeft = rect.left;
          originTop = rect.top;
          nextLeft = 0;
          nextTop = 0;
          el.style.transition = 'none';
          el.style.cursor = 'grabbing';
          try { el.setPointerCapture && e.pointerId != null && el.setPointerCapture(e.pointerId); } catch (err) {}
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();
        }

        function onMove(e) {
          if (!dragging) return;
          if (e.pointerId != null && pointerId != null && e.pointerId !== pointerId) return;
          var t = e.touches ? e.touches[0] : e;
          if (!t) return;
          var pos = clamp(originLeft + (t.clientX - startX), originTop + (t.clientY - startY));
          nextLeft = pos.left - originLeft;
          nextTop = pos.top - originTop;
          if (!raf) raf = requestAnimationFrame(tick);
          if (e.cancelable) e.preventDefault();
        }

        function onUp(e) {
          if (!dragging) return;
          if (e && e.pointerId != null && pointerId != null && e.pointerId !== pointerId) return;
          dragging = false;
          pointerId = null;
          if (raf) {
            cancelAnimationFrame(raf);
            raf = 0;
          }
          var pos = clamp(originLeft + nextLeft, originTop + nextTop);
          el.style.cursor = 'grab';
          el.style.transition = 'left 160ms cubic-bezier(0.22, 1, 0.36, 1), top 160ms cubic-bezier(0.22, 1, 0.36, 1)';
          commit(pos.left, pos.top);
        }

        el.addEventListener('pointerdown', onDown, { passive: false });
        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        el.addEventListener('touchstart', onDown, { passive: false });
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
        window.addEventListener('touchcancel', onUp);
      }

      function waitForSdk() {
        if (window.AgoraRTC) {
          try { AgoraRTC.setLogLevel(4); } catch (e) {}
          if (!client) {
            try {
              client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
              bindClientEvents(client);
            } catch (e) {}
          }
          enableLocalPreviewDrag();
          post({ type: 'ready' });
          return;
        }
        setTimeout(waitForSdk, 16);
      }
      waitForSdk();
    })();
  </script>
</body>
</html>`;
