const mongoose = require("mongoose");

const connectDB = async () => {
  const maxRetries = 5;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("MongoDB connected");
      return;
    } catch (error) {
      attempts++;
      console.error(
        `MongoDB connection failed (Attempt ${attempts} of ${maxRetries}):`,
        error
      );

      if (attempts >= maxRetries) {
        console.error("All connection attempts failed.");
        throw new Error("MongoDB connection failed after max retries.");
      }

      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait before retrying
    }
  }
};

module.exports = { connectDB };
