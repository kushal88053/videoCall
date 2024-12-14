// require("dotenv").config();

// const {
//   redisClient,
//   notifyQueue,
//   callQueue,
//   connectRedisClients,
// } = require("../config/redisClient");
process.on("SIGINT", () => {
  console.log("Job process exiting gracefully...");
  process.exit(0); // Exit with success code
});

console.log("hello job");

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception: ", err);
  process.exit(1); // Exit with error code
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at: ", promise, "reason: ", reason);
  process.exit(1); // Exit with error code
});

// console.log(process.env);
// const { getFriendsFromDb } = require("../services/userService");
// const { io } = require("../services/setupSocketServer");
// const { handleCallEnd } = require("./callhandler");
// const Notification = require("../model/notification.model");
// // Notify Friends
// const notifyFriends = async (io, userId, isActive) => {
//   try {
//     const friends = await getFriendsFromDb(userId);
//     for (const friend of friends) {
//       const friendId = friend._id;
//       const friendSocketId = await redisClient.hget(
//         `user:${friendId}`,
//         "socketId"
//       );

//       if (friendSocketId) {
//         io.to(friendSocketId).emit("friend_status", { userId, isActive });
//       }
//     }
//   } catch (error) {
//     console.error(`Error in notifyFriends for userId: ${userId}`, error);
//   }
// };

// connectRedisClients();
// const addNotificaitonToDB = () => {};

// const notification = async (io, userId, data) => {
//   try {
//     const SocketId = await redisClient.hget(`user:${userId}`, "socketId");
//     if (SocketId) {
//       io.to(SocketId).emit("notification", { userId, data });
//     }
//   } catch (error) {
//     console.error(`Error in notification for userId: ${userId}`, error);
//   }
// };

// // Notify Friends Job
// notifyQueue.process("notifyFriends", async (job) => {
//   console.log(`Processing notifyFriends job for userId: ${job.data.userId}`);

//   try {
//     const { userId, isActive } = job.data;

//     await notifyFriends(io, userId, isActive);

//     if (isActive === "false") {
//       await redisClient.del(`user:${userId}`);
//     }
//     await redisClient.del(`notifyFriendsJob:${userId}`);
//   } catch (error) {
//     console.error("Error processing notifyFriends job:", error);
//   }
// });

// // Notification Job
// notifyQueue.process("notification", async (job) => {
//   try {
//     const { user_id, topic, notification } = job.data;
//     console.log(job.data);
//   } catch (error) {
//     console.error("Error processing notification job:", error);
//   }
// });

// // Call Termination Job
// callQueue.process("terminateCall", async (job) => {
//   try {
//     const { userId, busyWith } = job.data;
//     const busy = await redisClient.hget(`user:${userId}`, "busy");
//     const active = await redisClient.hget(`user:${userId}`, "active");

//     if (active === "false" && busy === "true") {
//       const isAnotherPersonBusy = await redisClient.hget(
//         `user:${busyWith}`,
//         "busy"
//       );
//       const isAnotherPersonBusyWith = await redisClient.hget(
//         `user:${busyWith}`,
//         "busyWith"
//       );

//       if (
//         isAnotherPersonBusy === "true" &&
//         isAnotherPersonBusyWith === userId
//       ) {
//         await handleCallEnd(io, userId, busyWith);
//       }
//       await redisClient.del(`terminateCallJob:${userId}`);
//     }
//   } catch (error) {
//     console.error("Error processing terminateCall job:", error);
//   }
// });
