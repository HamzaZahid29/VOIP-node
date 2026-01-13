const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store connected users
const users = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Register user with their ID
  socket.on('register', (userId) => {
    users.set(userId, socket.id);
    socket.userId = userId;
    console.log(`User ${userId} registered with socket ${socket.id}`);
    
    // Notify client of successful registration
    socket.emit('registered', { userId, socketId: socket.id });
    
    // Broadcast online users
    io.emit('users-online', Array.from(users.keys()));
  });

  // Handle call offer
  socket.on('call-offer', (data) => {
    const { targetUserId, offer, callerId } = data;
    const targetSocketId = users.get(targetUserId);
    
    if (targetSocketId) {
      console.log(`Call from ${callerId} to ${targetUserId}`);
      io.to(targetSocketId).emit('incoming-call', {
        callerId,
        offer
      });
    } else {
      socket.emit('call-error', { message: 'User not available' });
    }
  });

  // Handle call answer
  socket.on('call-answer', (data) => {
    const { targetUserId, answer } = data;
    const targetSocketId = users.get(targetUserId);
    
    if (targetSocketId) {
      console.log(`Call answered by ${socket.userId} to ${targetUserId}`);
      io.to(targetSocketId).emit('call-answered', {
        answer,
        answeredBy: socket.userId
      });
    }
  });

  // Handle ICE candidates
  socket.on('ice-candidate', (data) => {
    const { targetUserId, candidate } = data;
    const targetSocketId = users.get(targetUserId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice-candidate', {
        candidate,
        from: socket.userId
      });
    }
  });

  // Handle call rejection
  socket.on('call-reject', (data) => {
    const { targetUserId } = data;
    const targetSocketId = users.get(targetUserId);
    
    if (targetSocketId) {
      console.log(`Call rejected by ${socket.userId}`);
      io.to(targetSocketId).emit('call-rejected', {
        rejectedBy: socket.userId
      });
    }
  });

  // Handle call end
  socket.on('call-end', (data) => {
    const { targetUserId } = data;
    const targetSocketId = users.get(targetUserId);
    
    if (targetSocketId) {
      console.log(`Call ended by ${socket.userId}`);
      io.to(targetSocketId).emit('call-ended', {
        endedBy: socket.userId
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      users.delete(socket.userId);
      console.log(`User ${socket.userId} disconnected`);
      io.emit('users-online', Array.from(users.keys()));
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    users: Array.from(users.keys()),
    connections: users.size 
  });
});