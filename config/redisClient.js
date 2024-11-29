const { createClient } = require("redis");

const redisHost = process.env.REDIS_HOST || "127.0.0.1"; // Use environment variables if available
const redisPort = process.env.REDIS_PORT || 6379;

// Create a Redis client
const redisClient = createClient({
  socket: {
    host: redisHost,
    port: redisPort,
  },
});

// Connect the Redis client
redisClient.connect().catch((err) => {
  console.error("Error connecting to Redis:", err);
});

// Handle Redis connection events
redisClient.on("connect", () => {
  console.log("Connected to Redis successfully");
});

redisClient.on("error", (err) => {
  console.error("Redis connection error:", err);
});

// Export the Redis client
module.exports = redisClient;
