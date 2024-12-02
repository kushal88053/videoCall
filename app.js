const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const redis = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
require("dotenv").config();
const cors = require("cors");
const db = require("./config/db");
db();
const { RtmTokenBuilder } = require("agora-token");
const verifyToken = require("./middlewares/verifyToken"); // Import the middleware
const verifySocket = require("./middlewares/verifySocket"); // Import the middleware

const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 3000;
const User = require("./model/users.model");
// Middleware setup
app.use(cookieParser());
app.use(express.json());
const corsOptions = {
  origin: process.env.BASE_URL || "http://localhost:3000", // Use the environment variable for frontend URL
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public"));
app.set("view engine", "ejs");
app.set("views", __dirname + "/views"); // Ensure this matches your project structure
// Load Agora credentials
const appID = "c2e45f74aae841e48403aa6c3fb4cf9a"; // Static App ID
const appCertificate = process.env.CERTIFICATE; // Loaded from .env file

// Redis setup

const redisClient = require("./config/redisClient");

// Set up Redis pub and sub clients for Socket.IO
const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();

pubClient.connect();
subClient.connect();

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.BASE_URL || "http://localhost:3000", // Use the environment variable for Socket.IO connection
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  },
});

// Use Redis adapter for Socket.IO
io.adapter(createAdapter(pubClient, subClient));

// Authentication routes
const authRoutes = require("./routers/auth");
const apiRoutes = require("./routers/api");
app.use("/auth", authRoutes);

app.get("/login", (req, res) => {
  console.log("login");
  res.render("login");
});

app.get("/signin", (req, res) => {
  console.log("singin");
  res.render("signin");
});

app.use(verifyToken);

// Routes

app.use("/api", apiRoutes);

app.get("/dashboard", (req, res) => {
  console.log("dashboard");
  res.render("dashboard");
});

app.get("/generate-token", (req, res) => {
  const uid = req.query.uid || Math.floor(Math.random() * 1000000);
  const expirationTimeInSeconds = 86400; // 1 day expiration

  const token = RtmTokenBuilder.buildToken(
    appID,
    appCertificate,
    uid,
    expirationTimeInSeconds
  );

  console.log(`Generated RTM Token for UID: ${uid}`);
  res.json({ token });
});

// Socket.IO connection handler
io.use(verifySocket);

io.on("connection", async (socket) => {
  const userId = String(socket.user.userId); // Ensure it's a string
  const socketId = String(socket.id); // Ensure it's a string

  // Store user info in Redis
  await redisClient.hSet(`user:${userId}`, {
    socketId: String(socketId),
    active: "true",
    busy: "false",
  });

  // Notify friends of active status
  notifyFriends(userId, true);

  // Handle incoming offer
  socket.on("send_offer", async ({ toUserId, offer }) => {
    console.log(`Offer received from ${userId} to ${toUserId}`);
    const toUserStatus = await redisClient.hGet(`user:${toUserId}`, "busy");
    const UserStatus = redisClient.hGet(`user:${userId}`, "busy");

    console.log(toUserStatus);

    if (toUserStatus === "true") {
      socket.emit("call_busy", { message: "User is busy on another call." });
      return;
    }

    if (UserStatus === "true") {
      socket.emit("call_busy", {
        message: "you are on calling or busy on another call.",
      });
      return;
    }

    const toUserSocketId = await redisClient.hGet(
      `user:${toUserId}`,
      "socketId"
    );

    if (toUserSocketId) {
      console.log("toUserSocketId", true);
      io.to(toUserSocketId).emit("incoming_offer", {
        fromUserId: userId,
        offer,
      });

      // Mark User 2 as receiving a call
    }

    socket.emit("offer_received_ack", { fromUserId: toUserId });

    await redisClient.hSet(`call:${userId}`, { status: "ringing", toUserId });
  });

  socket.on("cancel_call", async ({ toUserId }) => {
    console.log(`Call cancelled by ${userId}`);

    // Notify User 2 of the cancellation
    const toUserSocketId = await redisClient.hGet(
      `user:${toUserId}`,
      "socketId"
    );
    if (toUserSocketId) {
      io.to(toUserSocketId).emit("call_cancelled", { fromUserId: userId });

      // Save missed call for User 2
      await redisClient.lPush(
        `missed_calls:${toUserId}`,
        JSON.stringify({ fromUserId: userId, timestamp: Date.now() })
      );
    }

    // Mark both users as not busy
    await redisClient.hSet(`user:${userId}`, { busy: "false" });
    await redisClient.hSet(`user:${toUserId}`, { busy: "false" });

    // Clean up call data
    await redisClient.del(`call:${userId}`);
    await redisClient.del(`call:${toUserId}`);
  });

  socket.on("offer_received_ack", async ({ fromUserId }) => {
    console.log(`Receiver acknowledged offer from ${fromUserId}`);
    await redisClient.hSet(`user:${fromUserId}`, { busy: "true" });

    await redisClient.hSet(`call:${userId}`, { status: "ringing", fromUserId });

    // Get the caller's socket ID
    const callerSocketId = await redisClient.hGet(
      `user:${fromUserId}`,
      "socketId"
    );
    if (callerSocketId) {
      io.to(callerSocketId).emit("offer_acknowledged", {
        fromUserId: userId,
      });
    }
  });

  socket.on("call_rejected", async ({ toUserId }) => {
    console.log(`Call rejected by ${userId} for ${toUserId}`);

    // Mark both users as not busy
    await redisClient.hSet(`user:${toUserId}`, { busy: "false" });
    await redisClient.hSet(`user:${userId}`, { busy: "false" });

    const toUserSocketId = await redisClient.hGet(
      `user:${toUserId}`,
      "socketId"
    );
    if (toUserSocketId) {
      io.to(toUserSocketId).emit("call_rejected", { fromUserId: userId });
    }
  });

  // Handle answer from receiver
  socket.on("send_answer", async ({ toUserId, answer }) => {
    console.log(`Answer received from ${userId} to ${toUserId}`);
    const toUserSocketId = await redisClient.hGet(
      `user:${toUserId}`,
      "socketId"
    );

    if (toUserSocketId) {
      io.to(toUserSocketId).emit("answer_received", {
        fromUserId: userId,
        answer,
      });

      // Mark both users as busy during the call
      await redisClient.hSet(`user:${toUserId}`, { busy: "true" });
      await redisClient.hSet(`user:${userId}`, { busy: "true" });
    }
  });

  // Handle ICE candidates
  socket.on("send_candidate", async ({ toUserId, candidate }) => {
    console.log(`ICE Candidate received from ${userId} to ${toUserId}`);
    const toUserSocketId = await redisClient.hGet(
      `user:${toUserId}`,
      "socketId"
    );

    if (toUserSocketId) {
      io.to(toUserSocketId).emit("receive_candidate", {
        fromUserId: userId,
        candidate,
      });
    }
  });

  // Handle call end
  socket.on("call_ended", async ({ toUserId }) => {
    console.log(`Call ended by ${userId} with ${toUserId}`);

    // Update Redis status
    await redisClient.hSet(`user:${userId}`, { busy: "false" });
    await redisClient.hSet(`user:${toUserId}`, { busy: "false" });

    const toUserSocketId = await redisClient.hGet(
      `user:${toUserId}`,
      "socketId"
    );
    if (toUserSocketId) {
      io.to(toUserSocketId).emit("call_ended", { fromUserId: userId });
    }
  });

  // Disconnect handling
  socket.on("disconnect", async () => {
    console.log(`User ${userId} disconnected`);
    await redisClient.hSet(`user:${userId}`, {
      active: "false",
      busy: "false",
    });

    // Notify friends of offline status after timeout
    setTimeout(async () => {
      const isActive = await redisClient.hGet(`user:${userId}`, "active");
      if (isActive === "false") {
        notifyFriends(userId, false);
      }
    }, 60000);
  });

  // Message sending
  socket.on("send_message", async ({ toUserId, message }) => {
    const toUserSocketId = await redisClient.hGet(
      `user:${toUserId}`,
      "socketId"
    );
    if (toUserSocketId) {
      io.to(toUserSocketId).emit("receive_message", { from: userId, message });
    }
  });

  socket.on("answer_set_ack", async ({ toUserId, message }) => {
    console.log("answer_set_ack");
    const callerSocketId = await redisClient.hGet(
      `user:${toUserId}`,
      "socketId"
    );
    if (callerSocketId) {
      console.log("answer_set_ack", callerSocketId);
      io.to(callerSocketId).emit("answer_acknowledged", { message });
    }
  });
});

// Function to notify friends about user's status

async function notifyFriends(userId, isActive) {
  console.log("notifyfriends");
  const friends = await getFriendsFromDb(userId); // Replace with actual DB call to get friends
  console.log(friends);
  for (const friend of friends) {
    const friendId = friend._id; // Extract the friend's ObjectId

    // Retrieve the friend's socketId from Redis
    const friendSocketId = await redisClient.hGet(
      `user:${friendId}`,
      "socketId",
      "active"
    );

    console.log(friendSocketId);

    if (friendSocketId) {
      // Emit the friend's status update
      io.to(friendSocketId).emit("friend_status", { userId, isActive });
    }
  }
}

// Example function to verify token

// Example function to get friends from a database
async function getFriendsFromDb(userId) {
  console.log(userId);
  try {
    // Find the user by their ID and populate the "friends" field
    const user = await User.findById(userId).populate(
      "friends",
      "name email imageUrl"
    );

    console.log("user", user);
    // If the user or their friends list is not found, return an empty array
    if (!user || !user.friends) {
      return [];
    }

    // Return the populated friends' information
    return user.friends;
  } catch (error) {
    console.error("Error fetching friends from the database:", error);
    return [];
  }
}

// Start the server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
