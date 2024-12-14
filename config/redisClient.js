const Queue = require("bull");
const Redis = require("ioredis");

// Redis connection details
const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = process.env.REDIS_PORT || 6379;
const redisPassword = process.env.REDIS_PASSWORD || "";

// Create a single Redis client for regular operations and Bull queues
const redisClient = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  connectTimeout: 10000, // 10 seconds
  maxRetriesPerRequest: null, // disable retry logic for better control
});

// Create a separate Redis client for Pub/Sub (this client will be used exclusively for Pub/Sub operations)
const pubClient = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  connectTimeout: 10000, // 10 seconds
});

const subClient = pubClient.duplicate(); // Duplicate the pubClient for subscription

// Create Bull queues using the regular Redis client
const createBullClient = () => redisClient;

// Define Bull queues
const callQueue = new Queue("callQueue", {
  createClient: () => createBullClient(),
});

const notifyQueue = new Queue("notifyQueue", {
  createClient: () => createBullClient(),
});

// Connection handler
const connectRedisClients = async () => {
  try {
    if (redisClient.status !== "ready" && redisClient.status !== "connecting") {
      await redisClient.connect();
      console.log("Redis client connected successfully.");
    }

    // Connect Pub/Sub clients (for publishing and subscribing)
    if (pubClient.status !== "ready" && pubClient.status !== "connecting") {
      await pubClient.connect();
      console.log("Pub client connected successfully.");
    }

    if (subClient.status !== "ready" && subClient.status !== "connecting") {
      await subClient.connect();
      console.log("Sub client connected successfully.");
    }
  } catch (error) {
    console.error("Error connecting Redis clients:", error);
    throw error;
  }
};

// Graceful shutdown
const shutdownRedisClients = async () => {
  console.log("Shutting down Redis clients...");
  try {
    // Quit the Redis client gracefully (for Bull queues and regular commands)
    await redisClient.quit();
    console.log("Redis client shut down successfully.");

    // Quit Pub/Sub clients gracefully
    await pubClient.quit();
    await subClient.quit();
    console.log("Pub/Sub clients shut down successfully.");
  } catch (error) {
    console.error("Error during Redis client shutdown:", error);
  }
};

// Export all instances and functions
module.exports = {
  redisClient,
  pubClient,
  subClient,
  callQueue,
  notifyQueue,
  connectRedisClients,
  shutdownRedisClients,
};
