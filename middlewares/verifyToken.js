const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  let token;

  if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (req.headers && req.headers.authorization) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    if (req.originalUrl.startsWith("/api/")) {
      return res.status(401).json({ error: "Authentication token required" });
    } else {
      console.log("verify login middlware token not awailable");
      return res.redirect("/login");
    }
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    req.user = decoded; // Attach decoded token data to request
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    // Handle invalid or expired token
    if (req.originalUrl.startsWith("/api/")) {
      // If it's an API request, send JSON error
      return res.status(401).json({ error: "Invalid or expired token" });
    } else {
      // For page requests, redirect to login
      console.log("verify login middlware wrong token  ");
      return res.redirect("/login");
    }
  }
};

module.exports = verifyToken;
