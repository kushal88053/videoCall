const express = require("express");
// const verifyToken = require("../middlewares/verifyToken");
const {
  getUserDashboard,
  getFriendsList,
  getSentFriendRequests,
  getIncomingFriendRequests,
  getSearchFriendsList,
  sendFriendRequest,
  cancelFriendRequest,
  removeFriend,
  acceptFriendRequest,
  rejectFriendRequest,
  unblockingFriend,
  blockingFriend,
} = require("../controllers/dashboardController");

const {
  getUserNotifications,
} = require("../controllers/notificationController");

const router = express.Router();

// Route to get complete User Dashboard
router.get("/", getUserDashboard);

// Route to get Friends List
router.get("/getFriendsList", getFriendsList);

// Route to get Sent Friend Requests
router.get("/sent-requests", getSentFriendRequests);

// Route to get Incoming Friend Requests
router.get("/incoming-requests", getIncomingFriendRequests);

// Route to get Notifications
router.get("/notifications", getUserNotifications);

router.get("/getSearchFriendsList", getSearchFriendsList);

router.post("/sendFriendRequest", sendFriendRequest);

router.post("/cancelFriendRequest", cancelFriendRequest);

router.post("/removeFriend", removeFriend);

router.post("/acceptFriendRequest", acceptFriendRequest);

router.post("/rejectFriendRequest", rejectFriendRequest);

router.post("/blockingFriend", blockingFriend);

router.post("/unblockingFriend", unblockingFriend);

module.exports = router;
