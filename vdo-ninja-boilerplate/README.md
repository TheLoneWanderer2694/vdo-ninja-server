# P2P Video Streaming - OBS Overlay

## Quick Setup

### For Testing (same browser):
1. Open `ninja.html` → select "Sender" → click "Start Camera" (note Room ID)
2. Open `ninja.html?room=ROOMID` in another tab → select "Receiver" → click "Connect"

### For OBS:
1. Open `ninja.html` → select "Sender" → click "Start Camera" (note Room ID)
2. In OBS, add **Browser Source** with URL: `p2p-overlay.html?room=ROOMID`

## How It Works

- **WebSocket signaling** via `https://webrtc-signaling.glitch.me`
- **STUN server** for NAT traversal
- Both pages auto-connect on same-origin via BroadcastChannel

## Files
- `ninja.html` - Combined sender/receiver test page
- `p2p-overlay.html` - Dedicated OBS Browser Source receiver