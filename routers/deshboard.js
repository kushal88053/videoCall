const express = require("express");
const {
  getUserDashboard,
  getFriendsList,
  getSentFriendRequests,
  getIncomingFriendRequests,
  getNotifications,
} = require("../controllers/dashboardController");
const uploadToS3 = require("../middlewares/uploadMiddleware"); // Import the middleware

const router = express.Router();

// Route to get complete User Dashboard
router.get("/", getUserDashboard);

// Route to get Friends List
router.get("/friends", getFriendsList);

// Route to get Sent Friend Requests
router.get("/sent-requests", getSentFriendRequests);

// Route to get Incoming Friend Requests
router.get("/incoming-requests", getIncomingFriendRequests);

// Route to get Notifications
router.get("/notifications", getNotifications);

module.exports = router;
