const { createClient } = require("redis");

// Update the Redis host and port with your provided details
const redisHost =
  process.env.REDIS_HOST ||
  "redis-11934.c305.ap-south-1-1.ec2.redns.redis-cloud.com"; // Your Redis Host
const redisPort = process.env.REDIS_PORT || 11934; // Your Redis Port
const redisPassword = process.env.REDIS_PASSWORD || "your-redis-password"; // Add the Redis password if needed

// Create a Redis client with updated configuration
const redisClient = createClient({
  socket: {
    host: redisHost,
    port: redisPort,
  },
  password: redisPassword, // If authentication is needed
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
