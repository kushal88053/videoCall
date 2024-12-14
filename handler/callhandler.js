const {
  redisClient,
  callQueue,
  notifyQueue,
  pubClient,
  subClient,
} = require("../config/redisClient");
const mongoose = require("mongoose");

const CallHistory = require("../model/callhistory.model");

const markentry = async (fromUserId, toUserId, status) => {
  try {
    const callId = await redisClient.hget(`call:${toUserId}`, "callId");

    const startTime = await redisClient.hget(`call:${toUserId}`, "startTime");

    let callerStatus,
      receiverStatus,
      duration = 0,
      endTime = null;

    if (status === "cancel") {
      callerStatus = "ringing";
      receiverStatus = "missed";
    } else if (status === "reject") {
      callerStatus = "declined";
      receiverStatus = "declined";
    } else if (status === "completed") {
      callerStatus = "completed";
      receiverStatus = "completed";

      if (startTime) {
        endTime = Date.now();
        duration = Math.max(0, endTime - parseInt(startTime, 10)); // Calculate duration safely
      }
    } else {
      console.error("Invalid status passed:", status);
      return;
    }

    // Update the CallHistory record
    const result = await CallHistory.findOneAndUpdate(
      { callId },
      {
        caller_status: callerStatus,
        receiver_status: receiverStatus,
        duration,
        endTime: endTime ? new Date(endTime) : null,
      },
      { new: true }
    );

    if (result) {
      console.log("Call history updated successfully:", result);
    } else {
      console.error("No call history found for callId:", callId);
    }

    // Delete Redis keys for both users
    await redisClient.del(`call:${toUserId}`);
    await redisClient.del(`call:${fromUserId}`);
  } catch (error) {
    console.error("Error in markentry function:", error);
  }
};

const handleCallRejected = async (io, fromUserId, toUserId) => {
  console.log(`Call rejected by ${fromUserId} for ${toUserId}`);

  // Mark both users as not busy
  await redisClient.hset(`user:${toUserId}`, { busy: "false" });
  await redisClient.hset(`user:${fromUserId}`, { busy: "false" });

  await markentry(fromUserId, toUserId, "reject");
  // Get the socketId of the user to notify
  const toUserSocketId = await redisClient.hget(`user:${toUserId}`, "socketId");

  if (toUserSocketId) {
    io.to(toUserSocketId).emit("call_rejected", { fromUserId });
  } else {
    console.log(`User ${toUserId} is not online.`);
  }
};

const handleCallEnd = async (io, userId, toUserId) => {
  console.log(`Call ended by ${userId} with ${toUserId}`);

  await redisClient.hset(`user:${userId}`, { busy: "false" });
  await redisClient.hset(`user:${toUserId}`, { busy: "false" });

  const toUserSocketId = await redisClient.hget(`user:${toUserId}`, "socketId");
  if (toUserSocketId) {
    io.to(toUserSocketId).emit("call_ended", { fromUserId: userId });
  }
  markentry(userId, toUserId, "completed");
};

const handleCallCancelled = async (io, fromUserId, toUserId) => {
  console.log(`Call cancelled by ${fromUserId}`);

  const toUserSocketId = await redisClient.hget(`user:${toUserId}`, "socketId");
  if (toUserSocketId) {
    io.to(toUserSocketId).emit("call_cancelled", { fromUserId });
  }

  // Mark both users as not busy
  await redisClient.hset(`user:${fromUserId}`, { busy: "false" });
  await redisClient.hset(`user:${toUserId}`, { busy: "false" });

  await markentry(fromUserId, toUserId, "cancel");
};

const handleCallConnection = async (io, socketId, userId) => {
  console.log("Connected", { userId, socketId }); // Log the initial connection with userId and socketId

  try {
    // Log when setting the user's active status and socketId in Redis
    console.log(`Setting active status for user:${userId}`);
    await redisClient.hset(
      `user:${userId}`,
      "active",
      "true",
      "socketId",
      socketId,
      "disconnectTime",
      null
    );
    console.log(
      `User ${userId} status set to active with socketId ${socketId}`
    );

    // Check if there is an existing terminate job for the user
    const terminateJobKey = `terminateCallJob:${userId}`;
    console.log(
      `Checking for existing terminate job with key: ${terminateJobKey}`
    );
    const existingTerminateJobId = await redisClient.get(terminateJobKey);
    console.log(`Existing terminate job ID: ${existingTerminateJobId}`);

    if (existingTerminateJobId) {
      const job = await callQueue.getJob(existingTerminateJobId);

      if (job) {
        console.log(
          `Found existing terminate job, removing it: ${existingTerminateJobId}`
        );
        await job.remove();
      }
      await redisClient.del(terminateJobKey);
      console.log(`Deleted terminate job key: ${terminateJobKey}`);
    }
    const notifyJobKey = `notifyFriendsJob:${userId}`;
    console.log(`Checking for existing notify job with key: ${notifyJobKey}`);
    const existingNotifyJobId = await redisClient.get(notifyJobKey);
    console.log(`Existing notify job ID: ${existingNotifyJobId}`);

    if (!existingNotifyJobId) {
      console.log(
        `No existing notify job. Adding new notify job with delay of 5000ms.`
      );
      const job = await notifyQueue.add(
        `notifyFriends`,
        { userId, isActive: "true" },
        { delay: 5000 }
      );
      console.log(`New notify job added with ID: ${job.id}`);
      await redisClient.set(notifyJobKey, job.id);
    } else {
      console.log(`Existing notify job found. Job ID: ${existingNotifyJobId}`);
      const job = await notifyQueue.getJob(existingNotifyJobId);
      if (job) {
        console.log(`Found existing notify job, checking if it's inactive.`);
        console.log(job.data);
        if (job.data.isActive === "false") {
          console.log(
            `Notify job is inactive. Removing and re-adding with active status.`
          );
          await job.remove();
          await redisClient.del(notifyJobKey);

          const newJob = await notifyQueue.add(
            `notifyFriends`,
            { userId, isActive: "true", from: "connect" },
            { delay: 5000 }
          );
          console.log(`Re-added notify job with new ID: ${newJob.id}`);
          await redisClient.set(notifyJobKey, newJob.id);
        }
      }
    }
  } catch (error) {
    console.error("Error in handleCallConnection:", error);
  }
};

const handleSocketReconnect = async (io, userId) => {
  console.log("reconnection");
};

const handleSocketDisconnection = async (io, userId, triggerFrom) => {
  console.log(
    `[disconnect] User ${userId} disconnected. Triggered by: ${triggerFrom}`
  );
  const disconnectTimestamp = Date.now();
  console.log(`[disconnect] Disconnect timestamp: ${disconnectTimestamp}`);

  // Fetch the user state from Redis
  console.log(
    `[disconnect] Fetching user state for user ${userId} from Redis...`
  );
  const userState = await redisClient.hgetall(`user:${userId}`);
  console.log(`[disconnect] User state fetched: ${JSON.stringify(userState)}`);

  const { busy, busyWith } = userState;
  console.log(
    `[disconnect] User ${userId} state - busy: ${busy}, busyWith: ${busyWith}`
  );

  // Update the user's state in Redis on disconnect
  if (triggerFrom === "disconnect") {
    console.log(`[disconnect] Updating user ${userId}'s state in Redis...`);
    await redisClient.hset(
      `user:${userId}`,
      "disconnectTime",
      disconnectTimestamp,
      "active",
      "false",
      "busy",
      busy,
      "busyWith",
      busyWith
    );
    console.log(`[disconnect] User ${userId}'s state updated in Redis.`);
  }

  // If the user was busy and had a call, schedule the termination job
  if (busy == "true" && busyWith) {
    console.log(
      `[disconnect] User ${userId} was busy with user ${busyWith}. Scheduling termination job...`
    );
    const terminateJobKey = `terminateCallJob:${userId}`;
    const existingJobId = await redisClient.get(terminateJobKey);

    if (!existingJobId) {
      console.log(
        `[disconnect] No existing termination job found. Creating a new job to terminate call.`
      );

      const activeKnow = await redisClient.hget(`user:${userId}`, "active");

      if (activeKnow == "false") {
        const job = await callQueue.add(
          "terminateCall",
          { userId, busyWith },
          { delay: 15000 } // Delay termination by 15 seconds
        );
        await redisClient.set(terminateJobKey, job.id);
      }

      console.log(
        `[disconnect] Termination job created for user ${userId} with job ID: ${job.id}`
      );
    } else {
      console.log(
        `[disconnect] Existing termination job found for user ${userId}. Job ID: ${existingJobId}`
      );
    }
  } else {
    console.log(
      `[disconnect] User ${userId} was not busy or no call was active. Skipping termination job.`
    );
  }

  // Handle the notification job to inform friends about the disconnection
  const notifyJobKey = `notifyFriendsJob:${userId}`;
  console.log(
    `[disconnect] Checking for existing notification job for user ${userId}...`
  );
  const existingNotifyJobId = await redisClient.get(notifyJobKey);

  if (existingNotifyJobId) {
    console.log(
      `[disconnect] Existing notification job found with job ID: ${existingNotifyJobId}. Removing the existing job.`
    );
    const existingNotifyJob = await notifyQueue.getJob(existingNotifyJobId);

    if (existingNotifyJob) {
      await existingNotifyJob.remove();
      await redisClient.del(notifyJobKey);
      console.log(
        `[disconnect] Existing notification job removed and job key deleted.`
      );
    }
  }

  // Create a new job to notify friends about the user's disconnection
  console.log(
    `[disconnect] Creating a new job to notify friends about the disconnection of user ${userId}...`
  );

  const activeKnow = await redisClient.hget(`user:${userId}`, "active");
  console.log(activeKnow);
  if (activeKnow == "false") {
    const job = await notifyQueue.add(
      "notifyFriends",
      { userId, isActive: "false", from: "disconnect" },
      { delay: 30000 } // Delay notification by 30 seconds
    );
    await redisClient.set(notifyJobKey, job.id);

    console.log("disconnect active how false ");
    console.log(
      `[disconnect] Notification job created for user ${userId} with job ID: ${job.id}`
    );
  }
};

const handleCallOffer = async (io, userId, toUserId, offer) => {
  console.log(`Offer received from ${userId} to ${toUserId}`);
  const toUserStatus = await redisClient.hget(`user:${toUserId}`, "busy");
  const UserStatus = redisClient.hget(`user:${userId}`, "busy");

  if (toUserStatus === "true") {
    socket.emit("call_busy", { message: "User is busy on another call." });
    return;
  }

  if (UserStatus === "true") {
    socket.emit("call_busy", {
      message: "you are on calling or busy on another call.",
    });
    return;
  }

  const toUserSocketId = await redisClient.hget(`user:${toUserId}`, "socketId");

  if (toUserSocketId) {
    console.log("toUserSocketId", true);
    io.to(toUserSocketId).emit("incoming_offer", {
      fromUserId: userId,
      offer,
    });
  }

  const callHistory = await CallHistory.create({
    caller: new mongoose.Types.ObjectId(String(userId)), // Correct ObjectId generation
    receiver: new mongoose.Types.ObjectId(String(toUserId)), // Correct ObjectId generation
    caller_status: "not_connected", // Initial state of the call
    startTime: new Date(), // When the call was initiated
  });

  const callId = callHistory.callId; // Retrieve the generated callId

  // socket.emit("offer_received_ack", { fromUserId: toUserId });

  await redisClient.hset(`call:${userId}`, {
    status: "not_connected",
    callId,
  });
};

const handleOfferAsk = async (io, userId, fromUserId) => {
  console.log(`Receiver acknowledged offer from ${fromUserId}`);
  await redisClient.hset(`user:${fromUserId}`, { busy: "true" });

  await redisClient.hset(`call:${userId}`, { status: "ringing", fromUserId });

  // Get the caller's socket ID
  const callerSocketId = await redisClient.hget(
    `user:${fromUserId}`,
    "socketId"
  );
  if (callerSocketId) {
    io.to(callerSocketId).emit("offer_acknowledged", {
      fromUserId: userId,
    });
  }

  // Retrieve the callId for the fromUserId (ensure it's awaited properly)
  const callId = await redisClient.hget(`call:${fromUserId}`, "callId");

  // Set the status for the fromUserId in Redis as "Ringing"
  await redisClient.hset(`call:${fromUserId}`, {
    caller_status: "Ringing",
  });

  // Set the status for the userId in Redis as "missed_call" and associate the callId
  await redisClient.hset(`call:${userId}`, {
    receiver_status: "missed",
    callId, // Ensure the callId value is correctly passed
  });
};

const handleCallAnswer = async (io, userId, toUserId, answer) => {
  console.log(`Answer received from ${userId} to ${toUserId}`);
  const toUserSocketId = await redisClient.hget(`user:${toUserId}`, "socketId");

  if (toUserSocketId) {
    io.to(toUserSocketId).emit("answer_received", {
      fromUserId: userId,
      answer,
    });

    // Mark both users as busy during the call
    await redisClient.hset(`user:${toUserId}`, { busy: "true" });
    await redisClient.hset(`user:${userId}`, { busy: "true" });
  }
};

const handleCandidate = async (io, userId, toUserId, candidate) => {
  console.log(`ICE Candidate received from ${userId} to ${toUserId}`);
  const toUserSocketId = await redisClient.hget(`user:${toUserId}`, "socketId");

  if (toUserSocketId) {
    io.to(toUserSocketId).emit("receive_candidate", {
      fromUserId: userId,
      candidate,
    });
  }
};

const handleAnswerAsk = async (io, userId, toUserId, message) => {
  console.log("answer_set_ack");
  const callerSocketId = await redisClient.hget(`user:${toUserId}`, "socketId");
  await redisClient.hset(`user:${toUserId}`, {
    busyWith: toUserId,
  });

  await redisClient.hset(`user:${userId}`, {
    busyWith: userId,
  });

  await redisClient.hset(`call:${userId}`, {
    status: "connected",
    start: Date.now(),
  });

  // Set the status for the userId in Redis as "missed_call" and associate the callId
  await redisClient.hset(`call:${toUserId}`, {
    status: "connected",
    start: Date.now(),
  });

  if (callerSocketId) {
    console.log("answer_set_ack", callerSocketId);
    io.to(callerSocketId).emit("answer_acknowledged", { message });
  }
};

const handleMessage = async (io, userId, toUserId, message) => {
  const toUserSocketId = await redisClient.hget(`user:${toUserId}`, "socketId");
  if (toUserSocketId) {
    io.to(toUserSocketId).emit("receive_message", { from: userId, message });
  }
};

const notifyCallEnd = async (io, req, res) => {
  try {
    const { type, toUserId } = req.body;
    const fromUserId = req.user.userId;

    if (type === "cancel") {
      await handleCallCancelled(io, fromUserId, toUserId);
    } else if (type === "reject") {
      await handleCallRejected(io, fromUserId, toUserId);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Error in notifyCallEnd:", error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = {
  handleCallCancelled,
  handleCallEnd,
  handleCallRejected,
  handleCallConnection,
  handleCallOffer,
  handleOfferAsk,
  handleCallAnswer,
  handleAnswerAsk,
  handleSocketReconnect,
  handleSocketDisconnection,
  handleMessage,
  handleCandidate,
  notifyCallEnd,
};
