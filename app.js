const express = require("express");
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const app = express();
const PORT = process.env.PORT || 3000;
const User = require("./model/users.model");
app.use(cookieParser());
app.use(express.json());

const corsOptions = {
  origin: process.env.BASE_URL || "http://localhost:3000",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
  credentials: true,
};
app.use(cors(corsOptions));

const { initializeServices } = require("./config");
const setupRoutes = require("./routers");

const initConfig = async () => {
  try {
    await initializeServices();
  } catch (error) {
    console.error("App initialization failed:", error);
    process.exit(1);
  }
};

initConfig()
  .then(() => {
    app.get("/health", (req, res) => {
      res.status(200).send("OK");
    });

    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(__dirname + "/public"));
    app.set("view engine", "ejs");
    app.set("views", __dirname + "/views");

    const { shutdownRedisClients } = require("./config/redisClient");
    const { setupSocketServer } = require("./services/setupSocketServer");

    const { io, server } = setupSocketServer(app);

    const { handleSocketEvents } = require("./handler/socketHandler");

    const { notifyCallEnd } = require("./handler/callhandler");
    const pagesHandler = require("./handler/pagesHandler");

    pagesHandler(app);
    setupRoutes(app);
    handleSocketEvents(io);

    app.post("/notify-call-end", (req, res) => notifyCallEnd(io, req, res));

    process.on("SIGINT", async () => {
      console.log("Closing server and disconnecting Redis...");
      await shutdownRedisClients();
      process.exit(0);
    });

    // Start the server after all services are initialized
    server.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    // If the initialization fails, exit the process
    console.error("Failed to initialize services", error);
    process.exit(1);
  });
