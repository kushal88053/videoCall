const authRoutes = require("./auth");
const apiRoutes = require("./api");
const verifyToken = require("../middlewares/verifyToken");

const setupRoutes = (app) => {
  console.log("api");
  app.use("/auth", authRoutes);

  app.use(verifyToken);

  app.use("/api", apiRoutes);
};

module.exports = setupRoutes;
