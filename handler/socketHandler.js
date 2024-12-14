const {
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
} = require("./callhandler");

const verifySocket = require("../middlewares/verifySocket");
const { notifyQueue, redisClient } = require("../config/redisClient");
const handleSocketEvents = (io) => {
  io.use(verifySocket);

  io.on("connection", async (socket) => {
    const userId = String(socket.user.userId);
    const socketId = String(socket.id);

    await handleCallConnection(io, socketId, userId);

    socket.on("send_offer", async ({ toUserId, offer }) => {
      await handleCallOffer(io, userId, toUserId, offer);
    });

    socket.on("cancel_call", async ({ toUserId }) => {
      await handleCallCancelled(io, userId, toUserId);
    });

    socket.on("offer_received_ack", async ({ fromUserId }) => {
      await handleOfferAsk(io, userId, fromUserId);
    });

    socket.on("call_rejected", async ({ toUserId }) => {
      await handleCallRejected(io, userId, toUserId);
    });

    socket.on("send_answer", async ({ toUserId, answer }) => {
      await handleCallAnswer(io, userId, toUserId, answer);
    });

    socket.on("send_candidate", async ({ toUserId, candidate }) => {
      await handleCandidate(io, userId, toUserId, candidate);
    });

    socket.on("call_ended", async ({ toUserId }) => {
      await handleCallEnd(io, userId, toUserId);
    });

    socket.on("disconnect", async () => {
      const disconnectJobKey = `disconnect:${userId}`;

      const job = await notifyQueue.add(
        "disconnect",
        { userId },
        { delay: 15000 }
      );
      await redisClient.set(disconnectJobKey, job.id);
      await handleSocketDisconnection(io, userId, "disconnect");
    });

    socket.on("reconnect", async () => {
      await handleSocketReconnect(io, userId);
    });

    socket.on("send_message", async ({ toUserId, message }) => {
      await handleMessage(io, userId, toUserId, message);
    });

    socket.on("answer_set_ack", async ({ toUserId, message }) => {
      await handleAnswerAsk(io, userId, toUserId, message);
    });
  });
};

module.exports = { handleSocketEvents };
