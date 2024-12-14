const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createServer } = require("http");
const { pubClient, subClient } = require("../config/redisClient");

let io;
const setupSocketServer = (app = null) => {
  const server = createServer(app); // Create HTTP server (with or without express)
  io = new Server(server, {
    cors: {
      origin: process.env.BASE_URL || "http://localhost:3000", // CORS configuration
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type"],
      credentials: true,
    },
  });

  io.adapter(createAdapter(pubClient, subClient));

  return { io, server };
};

const getSocketIO = () => {
  if (!io) {
    throw new Error(
      "Socket.IO is not initialized. Please call setupSocketServer first."
    );
  }
  return io;
};

module.exports = { setupSocketServer, getSocketIO };
