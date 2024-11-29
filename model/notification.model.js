const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User model
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false, // Default is unread
    },
  },
  { timestamps: true }
); // timestamps: true adds createdAt and updatedAt fields

// Create and export the Notification model
const Notification = mongoose.model("Notification", notificationSchema);
module.exports = Notification;
