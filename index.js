const express = require("express");
require("dotenv").config(); // Load .env file
const { RtmTokenBuilder } = require("agora-token"); // Only RtmTokenBuilder is used
const app = express();
const port = 3000;

// Middleware to handle JSON payloads in POST requests
app.use(express.json());
app.use(express.static(__dirname + "/public"));

// Load Agora credentials from environment variables
const appID = "c2e45f74aae841e48403aa6c3fb4cf9a"; // Static App ID
const appCertificate = process.env.CERTIFICATE; // Loaded from .env file

// Route to generate RTM token using GET
app.get("/generate-token", (req, res) => {
  const uid = req.query.uid || Math.floor(Math.random() * 1000000); // Generate UID if not provided
  const expirationTimeInSeconds = 3600; // Token expiration time (1 hour)

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  // Generate the RTM token
  const token = RtmTokenBuilder.buildToken(
    appID,
    appCertificate,
    uid,
    expirationTimeInSeconds
  );

  console.log(`Generated RTM Token for UID: ${uid}`);

  // Send the generated token as JSON
  res.json({ token });
});

// Start the server
app.listen(port, () => {
  console.log(`Token server running at http://localhost:${port}`);
});
