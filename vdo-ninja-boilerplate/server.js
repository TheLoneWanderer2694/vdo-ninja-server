const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static('public'));

const rooms = new Map();

io.on('connection', (socket) => {
  socket.on('join', ({ roomId, role }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.role = role;
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { sender: null, receivers: [] });
    }
    
    const room = rooms.get(roomId);
    
    if (role === 'sender') {
      room.sender = socket.id;
      socket.to(roomId).emit('sender-connected');
    } else {
      room.receivers.push(socket.id);
      socket.to(roomId).emit('receiver-connected', { receiverId: socket.id });
    }
  });

  socket.on('offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('offer', { offer });
  });

  socket.on('answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('answer', { answer });
  });

  socket.on('ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice-candidate', { candidate });
  });

  socket.on('disconnect', () => {
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      if (room.sender === socket.id) {
        room.receivers.forEach(r => io.to(r).emit('sender-disconnected'));
        rooms.delete(socket.roomId);
      } else {
        const idx = room.receivers.indexOf(socket.id);
        if (idx > -1) room.receivers.splice(idx, 1);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));