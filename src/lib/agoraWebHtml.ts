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
    #local.hidden { display: none; }
    /* Ringing: my camera fills the screen (WhatsApp style) until the other side's video arrives. */
    #local.full {
      top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
      width: 100% !important; height: 100% !important; max-width: none; max-height: none;
      min-width: 0; min-height: 0; border-radius: 0; border: none; box-shadow: none;
      transform: none !important; z-index: 1;
    }
    /*
     * Keep the remote host mounted for audio-only calls. Some Android WebView
     * versions stop media elements under display:none, which makes Agora's
     * remote audio track appear subscribed but remain silent.
     */
    #remote.audio-only { width: 1px; height: 1px; opacity: 0.01; pointer-events: none; }
    #audio-host { position: absolute; width: 1px; height: 1px; opacity: 0.01; overflow: hidden; pointer-events: none; }
    video { object-fit: cover; width: 100%; height: 100%; }
  </style>
  <script>
    /*
     * Load the Agora SDK with retries and a second CDN. A single failed
     * download used to leave the engine without an SDK for good, so every
     * call stayed on "Connecting…" until the app was restarted.
     */
    (function () {
      var sources = [
        'https://download.agora.io/sdk/release/AgoraRTC_N-4.24.0.js',
        'https://cdn.jsdelivr.net/npm/agora-rtc-sdk-ng@4.24.0/AgoraRTC_N-production.js'
      ];
      var attempt = 0;
      function load() {
        if (window.AgoraRTC) return;
        var script = document.createElement('script');
        script.src = sources[attempt % sources.length];
        script.async = true;
        script.onerror = function () {
          try { script.parentNode && script.parentNode.removeChild(script); } catch (e) {}
          attempt += 1;
          try {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log', message: 'Agora SDK load failed (attempt ' + attempt + ')'
            }));
          } catch (e) {}
          setTimeout(load, Math.min(8000, 500 * attempt));
        };
        document.head.appendChild(script);
      }
      load();
    })();
  </script>
</head>
<body>
  <div id="remote"></div>
  <div id="audio-host"></div>
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
      // Call state the health check below needs.
      var currentIsAudio = true;
      var micMuted = false;
      var videoMuted = false;
      // False for listen-only joins (live voice) until enableAudio.
      var wantAudio = false;
      var videoEnsuring = false;
      var healthTimer = null;
      // Bumped by leave() so microphone/camera work started for a call that
      // has since ended never leaves a device open.
      var session = 0;
      var micOpening = null;
      // Echo cancellation, noise suppression and gain control: the same
      // voice processing the web app uses, so both ends sound alike.
      var MIC_CONFIG = { AEC: true, ANS: true, AGC: true };
      // "motion" keeps video smooth on a weak network (drops resolution
      // before frame rate), the way WhatsApp video behaves.
      function cameraConfig() {
        return { facingMode: facingMode, encoderConfig: '480p_1', optimizationMode: 'motion' };
      }

      function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
      }

      function findTrack(kind) {
        return localTracks.find(function (t) { return t.trackMediaType === kind; });
      }

      function isPublished(track) {
        var published = (client && client.localTracks) || [];
        return published.indexOf(track) !== -1;
      }

      // The OS silenced the capture source (e.g. the audio session switched
      // away from recording). The track stays "live", so trackEnded misses it.
      function trackSilenced(track) {
        try {
          var mst = track && track.getMediaStreamTrack && track.getMediaStreamTrack();
          return !!mst && mst.readyState === 'live' && mst.muted === true;
        } catch (e) {
          return false;
        }
      }

      function trackEnded(track) {
        try {
          var mst = track && track.getMediaStreamTrack && track.getMediaStreamTrack();
          return !!mst && mst.readyState === 'ended';
        } catch (e) {
          return false;
        }
      }

      function playRemoteAudioTrack(track) {
        if (!track) return;
        try {
          track.play('audio-host');
        } catch (e) {
          try { track.play(); } catch (fallbackError) {}
        }
      }

      function playAllRemoteAudio() {
        if (!client) return;
        var remotes = client.remoteUsers || [];
        for (var i = 0; i < remotes.length; i++) {
          var user = remotes[i];
          try {
            if (user.audioTrack) {
              playRemoteAudioTrack(user.audioTrack);
              /*
               * Calling play again after the WebView has joined is intentional:
               * Android can reject the first play while the media session is
               * being established.
               */
              setTimeout(function (track) {
                return function () {
                  playRemoteAudioTrack(track);
                };
              }(user.audioTrack), 250);
            }
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

      function setLocalFull(full) {
        var local = document.getElementById('local');
        if (!local) return;
        if (full) local.classList.add('full');
        else local.classList.remove('full');
        postLocalRect();
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
        postLocalRect();
      }

      /*
       * The call screen sits on top of this page, so it cannot be touched
       * directly. Tell the app where my small camera view is, so it can put a
       * drag handle over it (see dragLocal), and only while it is the small
       * floating view (not full screen, not an audio call).
       */
      var lastRect = '';
      function postLocalRect() {
        var el = document.getElementById('local');
        if (!el) return;
        var shown = !el.classList.contains('hidden') && !el.classList.contains('full');
        var r = el.getBoundingClientRect();
        var rect = {
          type: 'local-rect',
          shown: shown && r.width > 0 && r.height > 0,
          x: Math.round(r.left),
          y: Math.round(r.top),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
        var key = JSON.stringify(rect);
        if (key === lastRect) return;
        lastRect = key;
        post(rect);
      }

      function resetLocalPosition() {
        var el = document.getElementById('local');
        if (!el) return;
        el.style.left = '';
        el.style.top = '';
        el.style.right = '';
        el.style.bottom = '';
        el.style.transform = '';
        el.style.transition = '';
      }

      async function stopTracks() {
        for (var i = 0; i < localTracks.length; i++) {
          try { localTracks[i].stop && localTracks[i].stop(); } catch (e) {}
          try { await localTracks[i].close(); } catch (e) {}
        }
        localTracks = [];
      }

      // The leave in progress; join() waits for it before using the client.
      var leaving = null;

      async function leave() {
        session += 1;
        joining = false;
        stopHealthCheck();
        wantAudio = false;
        micMuted = false;
        videoMuted = false;
        facingMode = 'user';
        micSilentChecks = 0;
        // Forget this call's channel, devices and views right away rather
        // than once Agora has finished leaving: the next call can start
        // meanwhile (an incoming call previews its camera), and finishing
        // this leave must not close its devices or clear its views.
        var tracks = localTracks;
        localTracks = [];
        joinedChannel = '';
        joinedUid = null;
        setLocalFull(false);
        resetLocalPosition();
        var remote = document.getElementById('remote');
        if (remote) remote.innerHTML = '';
        var run = (async function () {
          if (client) {
            try { await client.unpublish(tracks); } catch (e) {}
            try { await client.leave(); } catch (e) {}
          }
          closeTracks(tracks);
        })();
        leaving = run;
        try {
          await run;
        } finally {
          if (leaving === run) leaving = null;
        }
        post({ type: 'left' });
      }

      async function createLocalTracks(isAudio) {
        var hasAudio = localTracks.some(function (t) { return t.trackMediaType === 'audio'; });
        var hasVideo = localTracks.some(function (t) { return t.trackMediaType === 'video'; });
        if (isAudio && hasAudio) return;
        if (!isAudio && hasAudio && hasVideo) return;
        await stopTracks();
        var mySession = session;
        var created;
        if (isAudio) {
          created = [await AgoraRTC.createMicrophoneAudioTrack(MIC_CONFIG)];
        } else {
          try {
            created = await AgoraRTC.createMicrophoneAndCameraTracks(MIC_CONFIG, cameraConfig());
          } catch (e) {
            post({ type: 'log', message: 'camera failed, mic only: ' + (e && e.message) });
            created = [await AgoraRTC.createMicrophoneAudioTrack(MIC_CONFIG)];
          }
        }
        // The call ended while the devices were opening: release them.
        if (mySession !== session) {
          closeTracks(created);
          return;
        }
        if (findTrack('audio')) {
          closeTracks(created.filter(function (t) { return t.trackMediaType === 'audio'; }));
          created = created.filter(function (t) { return t.trackMediaType !== 'audio'; });
        }
        localTracks = localTracks.concat(created);
        var videoTrack = localTracks.find(function (t) { return t.trackMediaType === 'video'; });
        if (videoTrack) {
          videoTrack.play('local', { fit: 'cover' });
          postLocalRect();
        }
      }

      function closeTracks(tracks) {
        for (var i = 0; i < tracks.length; i++) {
          try { tracks[i].stop && tracks[i].stop(); } catch (e) {}
          try { tracks[i].close(); } catch (e) {}
        }
      }

      /*
       * Opens the microphone (once) without publishing it. join() runs this
       * alongside the channel join instead of after it, so the voice path is
       * ready the moment the join completes.
       */
      function openMicrophone() {
        if (previewing) {
          var retry = function () { return openMicrophone(); };
          return previewing.then(retry, retry);
        }
        if (findTrack('audio')) return Promise.resolve();
        if (micOpening) return micOpening;
        var mySession = session;
        var opening = AgoraRTC.createMicrophoneAudioTrack(MIC_CONFIG).then(function (track) {
          if (mySession !== session || findTrack('audio')) {
            closeTracks([track]);
            return;
          }
          localTracks.push(track);
        }, function (e) {
          post({ type: 'log', message: 'microphone open failed: ' + (e && e.message) });
        });
        micOpening = opening;
        opening.then(function () { if (micOpening === opening) micOpening = null; });
        return opening;
      }

      async function publishAudioWithRetry() {
        if (!client || !joinedChannel) throw new Error('Agora client is not joined');
        var lastError = null;
        for (var attempt = 0; attempt < 3; attempt++) {
          var audioTrack = null;
          try {
            audioTrack = localTracks.find(function (t) {
              return t.trackMediaType === 'audio';
            });
            if (audioTrack && isPublished(audioTrack) && audioTrack.enabled !== false && !trackEnded(audioTrack)) {
              post({ type: 'audio-enabled' });
              return;
            }
            if (!audioTrack) {
              var mySession = session;
              audioTrack = await AgoraRTC.createMicrophoneAudioTrack(MIC_CONFIG);
              if (mySession !== session) {
                closeTracks([audioTrack]);
                throw new Error('call ended');
              }
              localTracks.push(audioTrack);
            }
            await audioTrack.setEnabled(true);
            await client.publish([audioTrack]);
            post({ type: 'audio-enabled' });
            return;
          } catch (e) {
            lastError = e;
            if (audioTrack && attempt < 2) {
              try { await client.unpublish(audioTrack); } catch (unpublishError) {}
              try { audioTrack.stop && audioTrack.stop(); } catch (stopError) {}
              try { await audioTrack.close(); } catch (closeError) {}
              localTracks = localTracks.filter(function (t) { return t !== audioTrack; });
            }
            if (attempt < 2) {
              await new Promise(function (resolve) { setTimeout(resolve, 300); });
            }
          }
        }
        throw lastError || new Error('Microphone publish failed');
      }

      /*
       * Publishes the camera for video calls. join() used to publish only the
       * microphone, so the other side saw no video until a camera switch
       * (the only path that published video). The camera can also still be
       * held by another component when the call starts; retry instead of
       * silently falling back to audio only.
       */
      async function ensureVideoPublished() {
        if (!client || !joinedChannel || currentIsAudio || videoMuted) return;
        if (videoEnsuring) return;
        videoEnsuring = true;
        try {
          await ensureVideoPublishedOnce();
        } finally {
          videoEnsuring = false;
        }
      }

      async function ensureVideoPublishedOnce() {
        var video = findTrack('video');
        if (video && trackEnded(video)) {
          try { if (isPublished(video)) await client.unpublish(video); } catch (e) {}
          try { video.stop(); } catch (e) {}
          try { await video.close(); } catch (e) {}
          localTracks = localTracks.filter(function (t) { return t !== video; });
          video = null;
        }
        for (var attempt = 0; !video && attempt < 5; attempt++) {
          try {
            var mySession = session;
            video = await AgoraRTC.createCameraVideoTrack(cameraConfig());
            if (mySession !== session) {
              closeTracks([video]);
              return;
            }
            localTracks.push(video);
            video.play('local', { fit: 'cover' });
            postLocalRect();
          } catch (e) {
            post({ type: 'log', message: 'camera start failed (attempt ' + (attempt + 1) + '): ' + (e && e.message) });
            await sleep(700 * (attempt + 1));
            if (!client || !joinedChannel || currentIsAudio) return;
          }
        }
        if (!video) {
          post({ type: 'error', message: 'camera unavailable' });
          return;
        }
        if (isPublished(video)) return;
        try {
          if (!video.enabled) await video.setEnabled(true);
          await client.publish(video);
          post({ type: 'video-published' });
        } catch (e) {
          post({ type: 'error', message: 'camera publish failed: ' + (e && e.message) });
        }
      }

      /*
       * Periodic health check while in a call: keeps remote audio/video
       * playing and replaces local tracks Android stopped (for example when
       * another recorder took the microphone), so voice keeps flowing.
       */
      async function checkCallHealth() {
        if (!client || !joinedChannel) return;
        var remotes = client.remoteUsers || [];
        for (var i = 0; i < remotes.length; i++) {
          var user = remotes[i];
          try {
            if (user.hasAudio && !user.audioTrack) {
              await client.subscribe(user, 'audio');
            }
            if (user.audioTrack && !user.audioTrack.isPlaying) {
              playRemoteAudioTrack(user.audioTrack);
            }
            if (!currentIsAudio && user.hasVideo && !user.videoTrack) {
              await client.subscribe(user, 'video');
            }
            if (!currentIsAudio && user.videoTrack && !user.videoTrack.isPlaying) {
              user.videoTrack.play('remote', { fit: 'cover' });
            }
          } catch (e) {
            post({ type: 'log', message: 'remote health check failed: ' + (e && e.message) });
          }
        }
        var audio = findTrack('audio');
        // Require two consecutive silent checks (~6s) so a momentary
        // interruption doesn't restart the microphone.
        micSilentChecks = audio && wantAudio && !micMuted && trackSilenced(audio) ? micSilentChecks + 1 : 0;
        var micSilenced = micSilentChecks >= 2;
        if (wantAudio && !micMuted && (!audio || trackEnded(audio) || micSilenced || !isPublished(audio))) {
          if (audio && (trackEnded(audio) || micSilenced)) {
            micSilentChecks = 0;
            post({ type: 'log', message: 'microphone track ended or silenced; restarting it' });
            try { if (isPublished(audio)) await client.unpublish(audio); } catch (e) {}
            try { audio.stop && audio.stop(); } catch (e) {}
            try { await audio.close(); } catch (e) {}
            localTracks = localTracks.filter(function (t) { return t !== audio; });
          }
          try { await publishAudioWithRetry(); } catch (e) {
            post({ type: 'log', message: 'microphone republish failed: ' + (e && e.message) });
          }
        }
        await ensureVideoPublished();
      }

      var healthBusy = false;
      var micSilentChecks = 0;
      function startHealthCheck() {
        if (healthTimer) return;
        healthTimer = setInterval(function () {
          if (healthBusy) return;
          healthBusy = true;
          checkCallHealth().then(function () { healthBusy = false; }, function () { healthBusy = false; });
        }, 3000);
      }

      function stopHealthCheck() {
        if (healthTimer) clearInterval(healthTimer);
        healthTimer = null;
      }

      function bindClientEvents(c) {
        c.on('user-published', async function (user, mediaType) {
          try {
            await c.subscribe(user, mediaType);
            if (mediaType === 'audio' && user.audioTrack) {
              playRemoteAudioTrack(user.audioTrack);
              setTimeout(function (track) {
                return function () {
                  playRemoteAudioTrack(track);
                };
              }(user.audioTrack), 250);
            }
            if (mediaType === 'video' && user.videoTrack) {
              user.videoTrack.play('remote', { fit: 'cover' });
              setLocalFull(false);
            }
            post({ type: 'user-published', uid: user.uid, mediaType: mediaType });
            postLocalRect();
          } catch (e) {
            post({ type: 'error', message: 'subscribe failed: ' + (e && e.message) });
          }
        });
        // Lets the app tell when the other device is actually in the channel
        // (a listen-only peer never publishes).
        c.on('user-joined', function (user) {
          post({ type: 'user-joined', uid: user.uid });
        });
        c.on('user-unpublished', function (user, mediaType) {
          post({ type: 'user-unpublished', uid: user.uid, mediaType: mediaType });
        });
        // reason: "Quit" (left on purpose) or "ServerTimeOut" (connection
        // dropped; they may come back).
        c.on('user-left', function (user, reason) {
          post({ type: 'user-left', uid: user.uid, reason: reason || '' });
        });
        // Lets the call screen show "Reconnecting…" while the link recovers.
        c.on('connection-state-change', function (cur, prev, reason) {
          post({ type: 'connection-state', state: cur, reason: reason || '' });
        });
        c.on('token-privilege-will-expire', function () {
          post({ type: 'token-will-expire' });
        });
        c.on('network-quality', function (stats) {
          post({
            type: 'network-quality',
            uplink: (stats && stats.uplinkNetworkQuality) || 0,
            downlink: (stats && stats.downlinkNetworkQuality) || 0,
          });
        });
      }

      /*
       * Join failures that clear up by themselves: a network blip, or this
       * engine's previous session (the page was reloaded mid-call) that Agora
       * has not timed out yet, which fails the rejoin with UID_CONFLICT for
       * up to ~20 s. Bad tokens / app ids fail the same way every time.
       */
      var RETRYABLE_JOIN_ERRORS = ['UID_CONFLICT', 'CAN_NOT_GET_GATEWAY_SERVER', 'NETWORK_ERROR',
        'NETWORK_TIMEOUT', 'WS_ABORT', 'WS_DISCONNECT', 'WS_ERR'];
      function isRetryableJoinError(e) {
        var message = String((e && e.message) || e || '');
        if (/token|vendor key|dynamic key|app ?id/i.test(message)) return false;
        return RETRYABLE_JOIN_ERRORS.indexOf(String((e && e.code) || '')) !== -1 ||
          /UID_CONFLICT|NETWORK_ERROR|NETWORK_TIMEOUT/.test(message);
      }

      async function joinChannel(appId, channelName, token, uid, mySession) {
        for (var attempt = 1; ; attempt++) {
          try {
            await client.join(appId, channelName, token, uid);
            return;
          } catch (e) {
            if (mySession !== session || attempt >= 8 || !isRetryableJoinError(e)) throw e;
            post({ type: 'log', message: 'join failed (attempt ' + attempt + '), retrying: ' + ((e && (e.code || e.message)) || e) });
            await sleep(Math.min(4000, 1000 * attempt));
            if (mySession !== session) throw e;
          }
        }
      }

      // In the channel but the microphone would not start (in use, denied):
      // stay in the call, so the other side's voice and video still play,
      // and let the health check keep retrying, instead of hanging up.
      async function publishMicrophoneOrReport() {
        try {
          await publishAudioWithRetry();
        } catch (e) {
          post({ type: 'mic-unavailable', message: String((e && e.message) || e) });
        }
      }

      async function join(payload) {
        var appId = payload.appId;
        var token = payload.token;
        var channelName = payload.channelName;
        var uid = payload.uid;
        var isAudio = !!payload.isAudio;
        var publishAudio = payload.publishAudio !== false;
        setAudioOnlyUi(isAudio);
        currentIsAudio = isAudio;
        wantAudio = publishAudio;
        // A fresh join always starts unmuted (the native UI resets isMuted too).
        if (!(client && joinedChannel === channelName && joinedUid === uid)) {
          micMuted = false;
        }

        if (client && joinedChannel === channelName && joinedUid === uid) {
          if (publishAudio) await publishMicrophoneOrReport();
          ensureVideoPublished();
          post({ type: 'joined' });
          startHealthCheck();
          return;
        }

        if (joining) return;
        joining = true;
        var joinSession = session;

        try {
          // The previous call is still leaving: Agora cannot join meanwhile.
          if (leaving) {
            try { await leaving; } catch (e) {}
          }
          if (joinSession !== session) return;
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
          var mySession = session;
          // Open the microphone while joining, not after: the two are
          // independent and doing them together connects the call faster.
          var micReady = publishAudio ? openMicrophone() : null;
          await joinChannel(appId, channelName, token, uid, mySession);
          // The call ended while joining: leave() has left the channel (a
          // second leave here could cut off the next call's join).
          if (mySession !== session) return;
          joinedChannel = channelName;
          joinedUid = uid;
          if (micReady) await micReady;
          tryResumeAudio();

          if (publishAudio) await publishMicrophoneOrReport();
          if (mySession !== session) return;

          // Not awaited: camera retries must not delay "joined".
          ensureVideoPublished();

          post({ type: 'joined' });
          startHealthCheck();
          var remotes = client.remoteUsers || [];
          for (var r = 0; r < remotes.length; r++) {
            post({ type: 'user-joined', uid: remotes[r].uid });
          }
          for (var i = 0; i < remotes.length; i++) {
            var user = remotes[i];
            try {
              if (user.hasAudio) {
                await client.subscribe(user, 'audio');
                if (user.audioTrack) playRemoteAudioTrack(user.audioTrack);
              }
              if (!isAudio && user.hasVideo) {
                await client.subscribe(user, 'video');
                if (user.videoTrack) {
                  user.videoTrack.play('remote', { fit: 'cover' });
                  setLocalFull(false);
                }
                post({ type: 'user-published', uid: user.uid, mediaType: 'video' });
              }
            } catch (subErr) {
              post({ type: 'log', message: 'existing remote subscribe failed: ' + (subErr && subErr.message) });
            }
          }
          playAllRemoteAudio();
          joining = false;
        } catch (e) {
          // A join aborted by leave() belongs to a call that already ended;
          // reporting it would end the next call instead.
          if (joinSession !== session) return;
          joining = false;
          post({ type: 'error', message: 'join failed: ' + (e && e.message) });
        }
      }

      var previewing = null;
      async function preview(payload) {
        try {
          setAudioOnlyUi(!!payload.isAudio);
          if (!payload.isAudio && !joinedChannel) setLocalFull(true);
          var opening = createLocalTracks(!!payload.isAudio);
          previewing = opening;
          var done = function () { if (previewing === opening) previewing = null; };
          opening.then(done, done);
          await opening;
          post({ type: 'preview-ready' });
        } catch (e) {
          post({ type: 'error', message: 'preview failed: ' + (e && e.message) });
        }
      }

      async function muteAudio(muted) {
        micMuted = muted;
        var track = localTracks.find(function (t) { return t.trackMediaType === 'audio'; });
        if (track) {
          // setMuted keeps the microphone open and the track published, so
          // unmuting is instant and cannot fail to get the microphone back
          // (setEnabled released it). Same as the web app.
          try {
            if (typeof track.setMuted === 'function') await track.setMuted(muted);
            else await track.setEnabled(!muted);
          } catch (e) {}
        }
      }

      async function enableAudio() {
        if (!client || !joinedChannel) throw new Error('Live voice is not connected');
        wantAudio = true;
        await publishAudioWithRetry();
      }

      function resumeAudio() {
        playAllRemoteAudio();
        try {
          var media = document.querySelectorAll('audio, video');
          for (var i = 0; i < media.length; i++) {
            var promise = media[i].play && media[i].play();
            if (promise && promise.catch) promise.catch(function () {});
          }
        } catch (e) {}
      }

      async function muteVideo(muted) {
        videoMuted = muted;
        var track = localTracks.find(function (t) { return t.trackMediaType === 'video'; });
        if (track) {
          try { await track.setEnabled(!muted); } catch (e) {}
        }
        if (!muted) await ensureVideoPublished();
      }

      async function switchCamera() {
        var nextFacing = facingMode === 'user' ? 'environment' : 'user';
        var oldVideo = localTracks.find(function (t) { return t.trackMediaType === 'video'; });
        // Swap the camera in place: the other side keeps the picture instead
        // of losing it while a new track is published.
        if (oldVideo && !trackEnded(oldVideo) && typeof oldVideo.setDevice === 'function') {
          try {
            await oldVideo.setDevice({ facingMode: nextFacing });
            facingMode = nextFacing;
            return;
          } catch (e) {
            post({ type: 'log', message: 'in-place camera switch failed, reopening: ' + (e && e.message) });
          }
        }
        facingMode = nextFacing;
        try {
          var next = await AgoraRTC.createCameraVideoTrack(cameraConfig());
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
          if (client && joinedChannel && !videoMuted) await client.publish(next);
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
          else if (cmd.type === 'enableAudio') await enableAudio();
          else if (cmd.type === 'resumeAudio') resumeAudio();
          else if (cmd.type === 'muteVideo') await muteVideo(!!cmd.muted);
          else if (cmd.type === 'switchCamera') await switchCamera();
          else if (cmd.type === 'dragLocal') dragLocal(cmd);
          else if (cmd.type === 'renewToken') {
            if (client && cmd.token) await client.renewToken(cmd.token);
          }
        else if (cmd.type === 'republish') {
          // Attempt to republish existing localTracks if any — defensive recovery
          try {
            if (client && localTracks.length) {
              await client.unpublish(localTracks).catch(function(){});
              try { await client.publish(localTracks); } catch(e) { post({ type: 'log', message: 'republish failed: ' + (e && e.message) }); }
            }
          } catch(e) { post({ type: 'log', message: 'republish err: ' + (e && e.message) }); }
        }
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
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) resumeAudio();
      });
      window.addEventListener('message', onNativeMessage);
      document.addEventListener('message', onNativeMessage);

      var dragLocal = function () {};
      window.addEventListener('resize', function () { postLocalRect(); });

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
          setTimeout(postLocalRect, 200);
        }

        // The same drag, driven by the app's handle over this view
        // (gesture deltas in CSS px, which match the app's points).
        dragLocal = function (cmd) {
          if (cmd.phase === 'start') {
            if (el.classList.contains('hidden') || el.classList.contains('full')) return;
            onDown({ clientX: 0, clientY: 0, stopPropagation: function () {} });
          } else if (cmd.phase === 'move') {
            onMove({ clientX: Number(cmd.dx) || 0, clientY: Number(cmd.dy) || 0 });
          } else {
            onUp();
          }
        };

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
