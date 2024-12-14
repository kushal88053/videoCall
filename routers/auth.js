const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const verifyToken = require("../middlewares/verifyToken");
// Route for user signup
router.post("/signup", authController.signup);

router.post("/login", authController.login);

// Route for email verification
router.get("/verify/:token", authController.verifyEmail);
router.get("/logout", verifyToken, authController.logout);

router.post("/resend-email", authController.resend_email);

router.post("/forgot-password", authController.forgot_password);

router.post("/reset-password/:resetToken", authController.reset_password);

module.exports = router;
