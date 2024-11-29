const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Route for user signup
router.post("/signup", authController.signup);

router.post("/login", authController.login);

// Route for email verification
router.get("/verify/:token", authController.verifyEmail);

module.exports = router;
