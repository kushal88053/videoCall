const User = require("../model/users.model");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const URL = process.env.URL;
// Nodemailer configuration
const transporter = require("../utility/transpotor");

// Sign up controller
exports.signup = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Create and save user
    const newUser = new User({ name, email, password, verificationToken });
    await newUser.save();

    // Send verification email
    const verificationURL = `${URL}/auth/verify/${verificationToken}`;
    let ok = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Email Verification",
      text: `Click this link to verify your email: ${verificationURL}`,
    });

    res
      .status(200)
      .json({ message: "User registered. Please verify your email.", ok });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Email verification controller
exports.verifyEmail = async (req, res) => {
  const { token } = req.params;

  try {
    const user = await User.findOne({ verificationToken: token });

    let status = "false";
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    } else {
      user.isVerified = true;
      user.verificationToken = undefined;
      await user.save();
      status = "success";
    }

    // Mark user as verified

    res.render("verify", { message: "Email verified successfully", status });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const SECRET_KEY = process.env.SECRET_KEY;
  try {
    // Find user by email
    const user = await User.findOne({ email });

    if (!user.isVerified) {
      return res.status(401).json({ message: " email not verified." });
    }
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    // Compare provided password with stored hash (user.password is already hashed)
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    // Generate JWT token upon successful login
    const token = jwt.sign({ userId: user._id }, SECRET_KEY, {
      expiresIn: "1h", // Token valid for 1 hour
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 3600000,
    });

    console.log(process.env.NODE_ENV === "production");

    // Option 2: Send token as a Bearer token in response (or you can choose to do both)
    res.status(200).json({
      message: "Login successful",
      token: `${token}`, // Send token as Bearer token
      user: user.email,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.logout = async (req, res) => {
  try {
    // Clear the token stored in the cookie (if used)
    res.clearCookie("token"); // Clear the JWT token cookie (you might also have to clear refresh token cookies

    // Send a response indicating successful logout
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    // Handle any errors that might occur during the logout process
    console.error("Error logging out:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.resend_email = async (req, res) => {
  console.log("ok");
  const { email } = req.body;

  try {
    // Check if the user exists
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (existingUser.isVerified) {
      return res.status(400).json({ message: "Email is already verified." });
    }

    // Generate a new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Update user with new verification token
    existingUser.verificationToken = verificationToken;
    await existingUser.save();

    // Create verification URL
    const verificationURL = `${URL}/auth/verify/${verificationToken}`;

    // Send verification email
    const emailInfo = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Resend Email Verification",
      text: `Hello ${existingUser.name},\n\nPlease verify your email by clicking the link below:\n\n${verificationURL}\n\nIf you did not request this email, please ignore it.`,
    });

    console.log(emailInfo);
    // Check if the email was sent successfully
    if (emailInfo.accepted && emailInfo.accepted.length > 0) {
      return res.status(200).json({
        message: "Verification email sent successfully.",
        emailInfo,
      });
    } else {
      return res.status(500).json({
        message: "Failed to send verification email.",
        emailInfo,
      });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.forgot_password = async (req, res) => {
  const { email } = req.body;

  try {
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = Date.now() + 3600000; // 1 hour from now

    // Update user with reset token and expiry
    user.verificationToken = resetToken;
    user.tokenExpiry = tokenExpiry;
    await user.save();

    // Send email with reset link
    const resetURL = `${URL}/reset-password/${resetToken}`;
    const emailInfo = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset",
      text: `Click the link below to reset your password:\n\n${resetURL}\n\nThis link will expire in 1 hour.`,
    });

    if (emailInfo.accepted && emailInfo.accepted.length > 0) {
      return res.status(200).json({
        message: "Password reset email sent successfully.",
        emailInfo,
      });
    } else {
      return res.status(500).json({
        message: "Failed to send password reset email.",
        emailInfo,
      });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.reset_password = async (req, res) => {
  const { resetToken } = req.params;
  const { password } = req.body;
  console.log(password);

  try {
    // Find user by reset token
    const user = await User.findOne({ verificationToken: resetToken });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    // Check if the token has expired
    const tokenExpiration = user.tokenExpiry; // Assuming this field is saved
    const currentTime = Date.now();

    if (currentTime > tokenExpiration) {
      // Token has expired
      user.verificationToken = undefined; // Clear expired token
      await user.save(); // Optionally clear expired token in the DB
      return res.status(400).json({ message: "Token has expired." });
    }

    // Update the user's password
    user.password = password; // The hashing will be done automatically in the pre-save hook

    // Remove the verification token after successful reset
    user.verificationToken = undefined;
    user.tokenExpiry = undefined; // Optionally remove the expiration time field

    let result = await user.save(); // Triggers the pre-save hook to hash the password
    console.log(result);

    res.status(200).json({ message: "Password updated successfully.", result });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};
