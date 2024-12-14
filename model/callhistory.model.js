const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const callHistorySchema = new mongoose.Schema(
  {
    callId: {
      type: String,
      required: true,
      default: () => uuidv4(), // Generate a unique callId using UUID
      unique: true,
    },
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User model
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User model
      required: true,
    },
    callType: {
      type: String,
      enum: ["audio", "video"], // Call types: audio or video
      required: true,
    },
    caller_status: {
      type: String,
      enum: [
        "connected",
        "missed",
        "declined",
        "unanswered",
        "not_connected",
        "ringing",
        "completed",
      ], // Call status
      required: true,
      default: "not_connected",
    },
    receiver_status: {
      type: String,
      enum: [
        "connected",
        "missed",
        "declined",
        "unanswered",
        "not_connected",
        "not_pick_up",
        "completed",
      ], // Call status
      required: true,
      default: "not_connected",
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
    },
    duration: {
      type: Number, // Duration in seconds
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now, // Set the default to the current date
    },

    deleted_by: {
      type: String,
      enum: ["caller", "reciever", "none"], // Call status
      required: true,
      default: "none",
    },

    updatedAt: {
      type: Date,
      default: Date.now, // Set the default to the current date
    },
  },
  {
    versionKey: false, // Optionally disable __v versioning
  }
);

// Middleware to update the `updatedAt` field before each save
callHistorySchema.pre("save", function (next) {
  this.updatedAt = Date.now(); // Update the `updatedAt` field each time the document is saved
  next();
});

// Create the model based on the schema
const callHistory = mongoose.model("CallHistory", callHistorySchema);

module.exports = { callHistory };
