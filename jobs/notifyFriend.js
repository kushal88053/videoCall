const setupSocketServer = require("../services/setupSocketServer");

const { io, server } = setupSocketServer();
const {
  callQueue,
  notifyQueue,
  pubClient,
  subClient,
} = require("../config/redisClient");

const notifyFriendsOfDisconnection = async (userId, disconnectTimestamp) => {
  console.log(
    `Notifying friends of user ${userId} disconnect at ${disconnectTimestamp}`
  );
};

module.exports.processNotifyFriends = async (job) => {
  const { userId, disconnectTimestamp } = job.data;
  await notifyFriendsOfDisconnection(userId, disconnectTimestamp);
  return `Notified friends of user: ${userId}`;
};
