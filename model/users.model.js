const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Define the user schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true, // Ensure the email is unique
    },
    imageUrl: {
      type: String,
      required: false,
    },
    salt: {
      type: String,
      required: false,
    },
    password: {
      type: String,
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false, // Default is unverified until they verify via email
    },
    verificationToken: {
      type: String,
    },
    tokenExpiry: {
      type: Date,
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Self-referencing to link to other User documents
      },
    ],
    friendRequestsSent: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    friendRequestsReceived: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isOnline: {
      type: Boolean,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to hash the password before saving
userSchema.pre("save", async function (next) {
  try {
    if (this.isModified("password")) {
      const salt = await bcrypt.genSalt(10); // Generate salt with a factor of 10
      this.salt = salt; // Save the salt in the salt field
      this.password = await bcrypt.hash(this.password, salt); // Hash password with salt
    }
    next();
  } catch (error) {
    next(error); // Handle any errors during hashing
  }
});

// Method to compare hashed passwords during login
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Create the User model
const User = mongoose.model("User", userSchema);

module.exports = User;
