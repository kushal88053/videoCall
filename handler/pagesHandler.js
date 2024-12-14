const verifyToken = require("../middlewares/verifyToken");
const apiRoutes = require("../");
const pagesHandler = (app) => {
  app.get("/login", (req, res) => {
    console.log("log");
    res.render("login");
  });

  app.get("/signup", (req, res) => {
    console.log("log");

    res.render("signin");
  });

  app.get("/resend", (req, res) => {
    console.log("log");

    res.render("resend_email");
  });

  app.get("/forgot-password", (req, res) => {
    console.log("forgot");

    res.render("forgot_password");
  });

  app.get("/reset-password/:resetToken", (req, res) => {
    console.log("log");

    const { resetToken } = req.params;
    res.render("reset_password", { resetToken });
  });

  app.get("/dashboard", verifyToken, (req, res) => {
    res.render("dashboard");
  });
};

module.exports = pagesHandler;
