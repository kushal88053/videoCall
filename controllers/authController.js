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
  console.log({ name, email, password });
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
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Email Verification",
      text: `Click this link to verify your email: ${verificationURL}`,
    });

    res
      .status(200)
      .json({ message: "User registered. Please verify your email." });
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
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Mark user as verified
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.render("verify", { message: "Email verified successfully" });
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

    console.log(token);
    console.log(process.env);
    // Option 1: Send token as a cookie (HttpOnly, Secure flags recommended for production)
    res.cookie("token", token, {
      httpOnly: true, // Prevents client-side access to the cookie
      secure: process.env.NODE_ENV === "production", // Only use secure in production
      maxAge: 3600000, // 1 hour in milliseconds
    });

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
