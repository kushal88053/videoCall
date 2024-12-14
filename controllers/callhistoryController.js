const User = require("../model/users.model"); // Assuming you have a User model

const call = require("../model/callhistory.model"); // Assuming you have a User model

const mongoose = require("mongoose");

const addMissedCall = async (callerId, receiverId, callType, startTime) => {
  try {
    const call = new CallHistory({
      caller: new mongoose.Types.ObjectId(String(callerId)),
      receiver: new mongoose.Types.ObjectId(String(receiverId)),
      status: "missed",
      callType: callType,
      startTime: startTime,
    });
    await call.save();
    console.log("Missed call recorded successfully.");
  } catch (error) {
    console.error("Error recording missed call:", error);
  }
};
