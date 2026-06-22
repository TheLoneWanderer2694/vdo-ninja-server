(function() {
  const startButton = document.getElementById('startButton');
  const joinButton = document.getElementById('joinButton');
  const leaveButton = document.getElementById('leaveButton');
  const connectButton = document.getElementById('connectButton');
  const roomIdInput = document.getElementById('roomIdInput');
  const roomIdDisplay = document.getElementById('roomIdDisplay');
  const connectionStatus = document.getElementById('connectionStatus');
  const localVideo = document.getElementById('localVideo');
  const remoteVideo = document.getElementById('remoteVideo');
  const muteAudio = document.getElementById('muteAudio');
  const muteVideo = document.getElementById('muteVideo');
  const joinForm = document.getElementById('joinForm');
  const mediaControls = document.getElementById('mediaControls');
  const settingsPanel = document.getElementById('settingsPanel');
  const resolutionSelect = document.getElementById('resolutionSelect');
  const framerateSelect = document.getElementById('framerateSelect');

  const SIGNALING_SERVER = 'https://webrtc-signaling.glitch.me';
  const socket = io(SIGNALING_SERVER, { transports: ['websocket', 'polling'], reconnection: true });

  let peerManager = null;
  let roomId = null;

  const resolutionMap = {
    hd1080: { width: 1920, height: 1080 },
    hd720: { width: 1280, height: 720 },
    vga: { width: 640, height: 480 },
    qvga: { width: 320, height: 240 }
  };

  function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  function updateStatus(status) {
    connectionStatus.textContent = status;
    connectionStatus.className = status.toLowerCase().replace(' ', '-');
  }

  function getConstraints() {
    const resolution = resolutionSelect.value;
    const framerate = parseInt(framerateSelect.value);
    const res = resolutionMap[resolution];

    return {
      video: { width: res.width, height: res.height, frameRate: framerate },
      audio: true
    };
  }

  function handleRemoteStream(stream) {
    remoteVideo.srcObject = stream;
  }

  function handleConnectionStateChange(state) {
    updateStatus(state.charAt(0).toUpperCase() + state.slice(1));
    if (state === 'disconnected' || state === 'failed' || state === 'closed') {
      resetUI();
    }
  }

  function setupSocketListeners() {
    socket.on('connect', () => {
      console.log('Connected to signaling server');
      updateStatus('Connected');
    });

    socket.on('room-joined', ({ roomId: joinedRoomId, role }) => {
      roomId = joinedRoomId;
      roomIdDisplay.textContent = roomId;
      console.log(`Joined room as ${role}`);

      if (role === 'host') {
        initializeHost();
      } else {
        initializeGuest();
      }
    });

    socket.on('offer', async ({ from, offer }) => {
      console.log('Received offer');
      if (!peerManager) {
        peerManager = new PeerConnectionManager(socket, {
          onRemoteStream: handleRemoteStream,
          onConnectionStateChange: handleConnectionStateChange
        });
      }
      await peerManager.handleOffer(offer);
    });

    socket.on('answer', async ({ from, answer }) => {
      console.log('Received answer');
      await peerManager.handleAnswer(answer);
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
      await peerManager.handleIceCandidate(candidate);
    });

    socket.on('guest-connected', ({ guestId }) => {
      console.log('Guest connected, creating offer');
      if (peerManager) {
        peerManager.createOffer();
      }
    });

    socket.on('guest-disconnected', ({ guestId }) => {
      console.log('Guest disconnected');
      if (peerManager) {
        peerManager.close();
        peerManager = null;
      }
      remoteVideo.srcObject = null;
    });

    socket.on('host-disconnected', () => {
      alert('Host disconnected');
      resetUI();
    });

    socket.on('disconnect', () => {
      updateStatus('Disconnected');
    });
  }

  async function initializeHost() {
    startButton.style.display = 'none';
    leaveButton.style.display = 'inline-block';
    mediaControls.style.display = 'flex';
    settingsPanel.style.display = 'flex';
    joinForm.style.display = 'none';
  }

  async function initializeGuest() {
    startButton.style.display = 'none';
    joinButton.style.display = 'none';
    leaveButton.style.display = 'inline-block';
    joinForm.style.display = 'none';
  }

  async function startStream() {
    try {
      roomId = generateRoomId();
      const constraints = getConstraints();

      peerManager = new PeerConnectionManager(socket, {
        onRemoteStream: handleRemoteStream,
        onConnectionStateChange: handleConnectionStateChange
      });

      await peerManager.getMediaStream(constraints);
      localVideo.srcObject = peerManager.localStream;
      peerManager.createPeerConnection();

      socket.emit('join-room', { roomId, role: 'host' });
      socket.roomId = roomId;
      updateStatus('Room created');
      roomIdDisplay.textContent = roomId;
    } catch (error) {
      console.error('Error starting stream:', error);
      alert('Failed to start stream: ' + error.message);
    }
  }

  async function joinStream() {
    joinForm.style.display = 'flex';
  }

  async function connectToStream() {
    const enteredRoomId = roomIdInput.value.trim().toUpperCase();
    if (!enteredRoomId) return;

    try {
      const constraints = getConstraints();

      peerManager = new PeerConnectionManager(socket, {
        onRemoteStream: handleRemoteStream,
        onConnectionStateChange: handleConnectionStateChange
      });

      await peerManager.getMediaStream(constraints);
      localVideo.srcObject = peerManager.localStream;
      peerManager.createPeerConnection();

      socket.emit('join-room', { roomId: enteredRoomId, role: 'guest' });
      socket.roomId = enteredRoomId;
      roomId = enteredRoomId;
      joinForm.style.display = 'none';
    } catch (error) {
      console.error('Error joining stream:', error);
      alert('Failed to join stream: ' + error.message);
    }
  }

  function leaveStream() {
    if (peerManager) {
      peerManager.close();
    }
    if (socket.roomId) {
      socket.leave(socket.roomId);
    }
    resetUI();
  }

  function resetUI() {
    startButton.style.display = 'inline-block';
    joinButton.style.display = 'inline-block';
    leaveButton.style.display = 'none';
    joinForm.style.display = 'none';
    mediaControls.style.display = 'none';
    settingsPanel.style.display = 'none';

    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    roomIdDisplay.textContent = '--';
    roomId = null;
  }

  function toggleMute(button, kind) {
    if (peerManager && peerManager.localStream) {
      const track = peerManager.localStream.getTracks().find(t => t.kind === kind);
      if (track) {
        track.enabled = !track.enabled;
        button.textContent = track.enabled ? `Mute ${kind}` : `Unmute ${kind}`;
      }
    }
  }

  startButton.addEventListener('click', startStream);
  joinButton.addEventListener('click', joinStream);
  connectButton.addEventListener('click', connectToStream);
  leaveButton.addEventListener('click', leaveStream);
  muteAudio.addEventListener('click', () => toggleMute(muteAudio, 'audio'));
  muteVideo.addEventListener('click', () => toggleMute(muteVideo, 'video'));

  setupSocketListeners();
})();