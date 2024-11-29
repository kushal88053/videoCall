const Notification = require("../model/notification.model");
exports.getUserNotifications = async (req, res) => {
  console.log("asd");
  //   try {
  //     const userId = req.user.userId; // Assuming `req.user` is set after token verification

  //     // Query to get all unread notifications or the top 20 notifications for the user
  //     const notifications = await Notification.find({ userId, isRead: false }) // Fetch unread notifications
  //       .sort({ createdAt: -1 }) // Sort notifications by newest first
  //       .limit(20); // Limit to the latest 20 notifications

  //     res.status(200).json(notifications);
  //   } catch (error) {
  //     console.error("Error fetching notifications:", error);
  //     res.status(500).json({ message: "Server error" });
  //   }
};

exports.markNotificationAsRead = async (req, res) => {
  try {
    const notificationId = req.params.notificationId;

    await Notification.findByIdAndUpdate(notificationId, { isRead: true });

    res.status(200).json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "Server error" });
  }
};
