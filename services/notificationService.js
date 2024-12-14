const sendNotification = async (io, socketId, emailFor, data) => {
  io.to(socketId).emit(emailFor, data);
};

module.exports = { sendNotification };
