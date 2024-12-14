// index.js

const { connectDB } = require("./db");
const { connectRedisClients } = require("./redisClient");
const { verifyS3Connection } = require("./s3"); // AWS S3 verification

// Function to initialize all services before starting the app
const initializeServices = async () => {
  try {
    console.log("Initializing configuration services...");

    await connectDB();
    connectRedisClients()
      .then(() => {
        console.log("Redis clients connected successfully.");
      })
      .catch((error) => {
        console.error("Failed to connect Redis clients:", error);
      });
    await verifyS3Connection();

    console.log("All services initialized successfully.");
  } catch (error) {
    console.error("Error initializing services:", error);
    throw error; // Stop app startup if any service fails
  }
};

// Start the app

module.exports = { initializeServices };
