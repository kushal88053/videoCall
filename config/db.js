const mongoose = require("mongoose");

const connectDB = async () => {
  const maxRetries = 5;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log("MongoDB connected");
      break; // Exit the loop if connection is successful
    } catch (error) {
      attempts++;
      console.error(
        `MongoDB connection failed (Attempt ${attempts} of ${maxRetries}):`,
        error
      );

      if (attempts >= maxRetries) {
        console.error("All connection attempts failed. Exiting...");
        process.exit(1); // Exit the app if all retries fail
      }

      // Wait before retrying (e.g., 2 seconds)
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
};

module.exports = connectDB;
