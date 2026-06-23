class PeerConnectionManager {
  constructor(socket, options = {}) {
    this.socket = socket;
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.onRemoteStream = options.onRemoteStream || (() => {});
    this.onConnectionStateChange = options.onConnectionStateChange || (() => {});
    this.isInitiator = false;
    this.configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };
  }

  async getMediaStream(constraints = {}) {
    const defaultConstraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        ...defaultConstraints,
        ...constraints
      });
      return this.localStream;
    } catch (error) {
      console.error('Error getting media stream:', error);
      throw error;
    }
  }

  createPeerConnection() {
    this.pc = new RTCPeerConnection(this.configuration);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', {
          candidate: event.candidate,
          roomId: this.socket.roomId
        });
      }
    };

    this.pc.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.onRemoteStream(this.remoteStream);
    };

    this.pc.onconnectionstatechange = () => {
      this.onConnectionStateChange(this.pc.connectionState);
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.pc.addTrack(track, this.localStream);
      });
    }
  }

  async createOffer() {
    this.isInitiator = true;
    const offer = await this.pc.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: true
    });
    await this.pc.setLocalDescription(offer);
    this.socket.emit('offer', { offer, roomId: this.socket.roomId });
  }

  async createAnswer(offer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.socket.emit('answer', { answer, roomId: this.socket.roomId });
  }

  async handleAnswer(answer) {
    if (!this.pc.remoteDescription) {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async handleIceCandidate(candidate) {
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  async handleOffer(offer) {
    if (!this.pc) {
      this.createPeerConnection();
    }
    await this.createAnswer(offer);
  }

  close() {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }
}