const jwt = require("jsonwebtoken");

// The middleware function that verifies the token
const verifySocket = async (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication error: Token required"));
  }

  try {
    // Verify the token asynchronously using jwt.verify
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
        if (err) {
          reject("Invalid or expired token");
        } else {
          resolve(decoded); // If token is valid, resolve with decoded info
        }
      });
    });

    // Attach the decoded user information to the socket object
    socket.user = decoded;
    next();
  } catch (err) {
    console.error("Authentication error:", err); // Log the error for debugging
    return next(new Error("Authentication error: Invalid or expired token"));
  }
};

module.exports = verifySocket;
