const User = require("../model/users.model"); // Assuming you have a User model
const mongoose = require("mongoose");
const { use } = require("../routers/auth");

const { redisClient, notifyQueue } = require("../config/redisClient");
// Get User Dashboard Information
exports.getUserDashboard = async (req, res) => {
  try {
    const userId = req.user.userId; // Assuming req.user is set after token verification
    // Fetch user data
    const user = await User.findById(userId)
      .select("name email") // Select only name, email, and image for the user
      .populate("friends", "name email imageUrl") // Populate friends with specific fields
      .populate("friendRequestsSent", "name email imageUrl") // Populate sent friend requests
      .populate("blockedUsers", "name email imageUrl") // Populate incoming friend request
      .populate("friendRequestsReceived", "name email imageUrl"); // Populate incoming friend requests

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let status = [];
    const friendsWithStatus = await Promise.all(
      user.friends.map(async (friend) => {
        const activeStatus = await redisClient.hget(
          `user:${friend._id}`,
          "active"
        );

        // Push the status to the status array using the correct key-value syntax
        status.push({ _id: friend._id, active: activeStatus === "true" });

        // Return the friend object with the active status
        return {
          ...friend.toObject(), // Convert Mongoose document to plain JavaScript object
          active: activeStatus === "true", // Convert the status string to a boolean
        };
      })
    );

    // console.log("status", status);
    // console.log("friendsWithStatus", friendsWithStatus);

    // Return the user dashboard data
    res.status(200).json({
      friends: friendsWithStatus,
      sentFriendRequests: user.friendRequestsSent,
      incomingFriendRequests: user.friendRequestsReceived,
      blocked__user: user.blockedUsers,
      // notifications: user.notifications,
    });
  } catch (error) {
    console.error("Error fetching user dashboard:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Friends List
exports.getFriendsList = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming req.user is set after token verification
    const user = await User.findById(userId).populate("friends"); // Assuming a friends field

    res.status(200).json({ friends: user.friends });
  } catch (error) {
    console.error("Error fetching friends list:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Sent Friend Requests
exports.getSentFriendRequests = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming req.user is set after token verification
    const user = await User.findById(userId).populate("sentRequests"); // Assuming a sentRequests field

    res.status(200).json({ sentFriendRequests: user.sentRequests });
  } catch (error) {
    console.error("Error fetching sent friend requests:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Incoming Friend Requests
exports.getIncomingFriendRequests = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming req.user is set after token verification
    const user = await User.findById(userId).populate("incomingRequests"); // Assuming an incomingRequests field

    res.status(200).json({ incomingFriendRequests: user.incomingRequests });
  } catch (error) {
    console.error("Error fetching incoming friend requests:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Notifications
// exports.getNotifications = async (req, res) => {
//   try {
//     const userId = req.user.id; // Assuming req.user is set after token verification
//     const user = await User.findById(userId).populate("notifications"); // Assuming a notifications field

//     res.status(200).json({ notifications: user.notifications });
//   } catch (error) {
//     console.error("Error fetching notifications:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

//exports.getSearchFriendsList = async (req, res) => {
//   try {
//     const userId = String(req.user.userId); // Ensure userId is a valid ObjectId
//     const page = parseInt(req.query.page) || 1; // Current page
//     const limit = parseInt(req.query.limit) || 30; // Results per page

//     // Find the user's direct friends
//     const user = await User.findById(userId).populate("friends");
//     if (!user) {
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found" });
//     }

//     // Map the user's friends to ObjectIds
//     const userFriends = user.friends.map((friend) => String(friend._id));

//     console.log("Excluding IDs (user and direct friends):", [
//       userId,
//       ...userFriends,
//     ]);
//     console.log("Searching for friends of friends with IDs in:", userFriends);

//     // Find friends of friends, excluding user's friends and the user themself
//     const query = User.find({
//       _id: { $nin: [userId, ...userFriends] }, // Exclude the user and their direct friends
//       friends: { $in: userFriends }, // Must be a friend of user's friends
//     })
//       .skip((page - 1) * limit) // Paginate results
//       .limit(limit) // Limit to the specified number of friends
//       .populate("friends", "name email"); // Optionally populate friends' details (e.g., name, email)

//     console.log("Generated Query Filter:", query.getFilter());

//     // Execute the query
//     const friendsOfFriends = await query.exec();
//     console.log("Friends of Friends:", friendsOfFriends);

//     res.status(200).json({ success: true, data: friendsOfFriends });
//   } catch (err) {
//     console.error("Error in getSearchFriendsList:", err);
//     res.status(500).json({ success: false, message: "Internal Server Error" });
//   }
// };

//getSearchFriendsList

exports.getSearchFriendsList = async (req, res) => {
  console.log("suggestion");
  try {
    const userId = new mongoose.Types.ObjectId(String(req.user.userId)); // Ensure userId is a string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const query = req.query.query?.trim() || ""; // Query string for search

    // Redis keys

    if (query === "") {
      const baseKey = `suggestions:userId:${userId}`;
      const pageKey = `${baseKey}:page:${page}`;

      // Check Redis for cached page
      const cachedPage = await redisClient.get(pageKey);
      if (cachedPage) {
        console.log("Serving cached page.", pageKey, cachedPage);
        return res
          .status(200)
          .json({ success: true, data: JSON.parse(cachedPage) });
      }

      const results = [];
      const processedFriends = new Set(); // Track visited friends
      processedFriends.add(userId.toString()); // Exclude the primary user

      let currentLevel = 1;
      let startIndex = (page - 1) * limit;
      let remainingLimit = limit;
      let end = false;
      while (remainingLimit > 0) {
        const levelKey = `${baseKey}:level:${currentLevel}`;
        console.log("levelKey", levelKey);
        let levelData = await redisClient.get(levelKey);

        console.log("redix.level", levelData);
        if (!levelData) {
          console.log(`Fetching Level ${currentLevel} data...`);

          if (currentLevel === 1) {
            // Fetch Level 1: Direct Friends
            const user = await User.findById(userId)
              .select("friends")
              .populate({
                path: "friends",
                select: "name email image", // Replace with the fields you want to include from the friends collection
              });
            if (!user) {
              return res
                .status(404)
                .json({ success: false, message: "User not found" });
            }
            levelData = user.friends.map((friend) => ({
              _id: friend._id,
              name: friend.name,
              email: friend.email,
            }));
          } else {
            // Fetch Level N: Friends of Previous Level
            const prevLevelKey = `${baseKey}:level:${currentLevel - 1}`;
            const prevLevelData = await redisClient.get(prevLevelKey);

            if (!prevLevelData) {
              console.log("No previous level data found. Ending traversal.");
              break; // Exit loop if no previous level data exists
            }

            console.log(
              prevLevelData,
              Array.isArray(prevLevelData),
              typeof prevLevelData
            );
            // Extract the ObjectIds from the data
            const prevLevelFriends = JSON.parse(prevLevelData)
              .map((friend) => {
                if (mongoose.Types.ObjectId.isValid(friend._id)) {
                  return new mongoose.Types.ObjectId(friend._id); // Only pass the _id to ObjectId
                } else {
                  console.error(`Invalid ObjectId: ${friend._id}`); // Log invalid _id values
                  return null; // If not a valid ObjectId, return null
                }
              })
              .filter(Boolean); // Remove null entries from the array

            console.log("prevLevelFriends:", prevLevelFriends);

            const pipeline = [
              { $match: { _id: { $in: prevLevelFriends } } },
              {
                $lookup: {
                  from: "users",
                  localField: "friends",
                  foreignField: "_id",
                  as: "friendsOfFriends",
                },
              },
              { $unwind: "$friendsOfFriends" },
              {
                $match: {
                  "friendsOfFriends._id": {
                    $nin: Array.from(processedFriends).map(
                      (id) => new mongoose.Types.ObjectId(String(id))
                    ),
                  }, // Exclude already processed IDs
                },
              },
              {
                $group: {
                  _id: "$friendsOfFriends._id",
                  name: { $first: "$friendsOfFriends.name" },
                  email: { $first: "$friendsOfFriends.email" },
                },
              },
            ];
            console.log("pipleine", JSON.stringify(pipeline, null, 2));
            levelData = await User.aggregate(pipeline);
          }

          // Cache the level data in Redis
          if (levelData) {
            console.log("saving the redci");
            await redisClient.setEx(levelKey, 1800, JSON.stringify(levelData));
          }
        } else {
          levelData = JSON.parse(levelData);
        }

        console.log("levelData", levelData);

        // Check if level data is empty (End of levels)
        if (levelData.length === 0) {
          console.log("No data found for level", currentLevel);
          break; // End the loop if no data is found
        }

        if (currentLevel === 1) {
          // Exclude Level 1 (direct friends) from results
          for (const friend of levelData) {
            processedFriends.add(friend._id.toString()); // Still mark them as processed
          }
          currentLevel++;
          continue; // Skip to the next level
        }

        console.log("in the processed array");
        end = true;
        // Add unique friends from the current level to results
        for (const friend of levelData) {
          if (remainingLimit === 0) break;
          if (!processedFriends.has(friend._id.toString())) {
            results.push(friend);
            console.log(friend);
            end = false;
            processedFriends.add(friend._id.toString());
            remainingLimit--;
          }
        }
        console.log("prcesss , frind ", processedFriends);
        console.log("end", end);
        console.log("result ", results);

        currentLevel++;

        if (results.length >= limit || end) break; // Stop if enough data is collected
      }

      // Cache the current page
      if (results.length) {
        await redisClient.setEx(pageKey, 1800, JSON.stringify(results));
      }

      console.log(`Returning results for page ${page}`);
      return res.status(200).json({ success: true, data: results });
    } else {
      const searchResults = await User.find({
        $or: [
          { name: { $regex: query, $options: "i" } },
          { email: { $regex: query, $options: "i" } },
        ],
      })
        .limit(limit)
        .select("name email image"); // Customize fields as needed

      return res.status(200).json({ success: true, data: searchResults });
    }
  } catch (error) {
    console.error("Error in getFriendSuggestions:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const validateObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid ID provided");
  }
};

// Send Friend Request
exports.sendFriendRequest = async (req, res) => {
  console.log("sendFriendRequest");
  const { friend_id } = req.body;
  const user_id = req.user.userId; // Assuming user_id is attached to req.user from authentication middleware

  console.log(`Friend ID: ${friend_id}, User ID: ${user_id}`);

  // Start a session for the transaction
  const session = await mongoose.startSession();

  try {
    // Validate Object IDs
    validateObjectId(friend_id);
    validateObjectId(user_id);

    // Check if the request already exists
    const [user, friend] = await Promise.all([
      User.findById(user_id, "name email imageUrl   friendRequestsSent").exec(),
      User.findById(friend_id, "friendRequestsReceived").exec(),
    ]);

    if (!friend) {
      throw new Error("Friend not found.");
    }

    if (
      user.friendRequestsSent.includes(friend_id) ||
      friend.friendRequestsReceived.includes(user_id)
    ) {
      return res.status(400).json({ error: "Friend request already sent." });
    }

    // Start transaction
    session.startTransaction();

    // Add friend_id to user's friendRequestsSent
    await User.findByIdAndUpdate(
      user_id,
      { $addToSet: { friendRequestsSent: friend_id } },
      { session }
    );

    // Add user_id to friend's friendRequestsReceived
    await User.findByIdAndUpdate(
      friend_id,
      { $addToSet: { friendRequestsReceived: user_id } },
      { session }
    );

    // Commit the transaction if both operations succeed
    await session.commitTransaction();

    // End the session after commit
    session.endSession();

    // Add a notification job to the queue
    await notifyQueue.add("notification", {
      user_id: friend_id,
      topic: "INCOMING_REQUEST",
      notification: {
        subject: "Friend Request",
        request_data: {
          id: user._id,
          imageUrl: user.imageUrl,
          email: user.email,
        },
        message: "You have received a new friend request.",
      },
    });

    res.status(200).json({ message: "Friend request sent successfully." });
  } catch (error) {
    // Roll back the transaction if there is an error
    await session.abortTransaction();
    session.endSession();

    console.error("Error sending friend request:", error.message);
    res
      .status(400)
      .json({ error: `Failed to send friend request: ${error.message}` });
  }
};

exports.cancelFriendRequest = async (req, res) => {
  const { friend_id } = req.body;
  const user_id = req.user.userId; // Assuming user_id is attached to req.user from authentication middleware

  try {
    // Validate friend_id
    validateObjectId(friend_id); // Ensure friend_id is valid
    validateObjectId(user_id);
    const user = await User.findById(
      user_id,
      "name email imageUrl friendRequestsSent"
    ).exec();
    const friend = await User.findById(
      friend_id,
      "friendRequestsReceived"
    ).exec();

    if (
      !user ||
      !friend ||
      !user.friendRequestsSent.includes(friend_id) ||
      !friend.friendRequestsReceived.includes(user_id)
    ) {
      return res.status(400).json({
        error: "Friend request does not exist or has already been cancelled",
      });
    }

    // Start a session for the transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Remove friend_id from user's friendRequestsSent
      await User.findByIdAndUpdate(
        user_id,
        { $pull: { friendRequestsSent: friend_id } },
        { new: true, session } // Include session for transactional consistency
      );

      // Remove user_id from friend's friendRequestsReceived
      await User.findByIdAndUpdate(
        friend_id,
        { $pull: { friendRequestsReceived: user_id } },
        { new: true, session }
      );

      // Commit the transaction if all updates succeed
      await session.commitTransaction();
      session.endSession();

      await notifyQueue.add("notification", {
        user_id: friend_id,
        topic: "CANCEL_REQUEST",
        notification: {
          subject: "Cancel  Request",
          request_data: {
            id: user._id,
            imageUrl: user.imageUrl,
            email: user.email,
          },
          message: "Request is Cancel",
        },
      });

      res
        .status(200)
        .json({ message: "Friend request cancelled successfully" });
    } catch (transactionError) {
      // Roll back the transaction in case of any error
      await session.abortTransaction();
      session.endSession();

      console.error("Transaction error:", transactionError);
      res.status(500).json({ error: "Failed to cancel friend request" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(400).json({ error: error.message });
  }
};

// Accept Friend Request
exports.acceptFriendRequest = async (req, res) => {
  console.log("acceptFriendRequest");
  const friend_id = new mongoose.Types.ObjectId(String(req.body.friend_id));

  const user_id = new mongoose.Types.ObjectId(String(req.user.userId));

  try {
    validateObjectId(friend_id);

    const user = await User.findById(
      user_id,
      "name email imageUrl friendRequestsReceived friendRequestsSent friends"
    ).exec();
    const friend = await User.findById(
      friend_id,
      " friendRequestsSent friendRequestsReceived friends"
    ).exec();

    if (!user || !friend) {
      return res.status(404).json({ error: "User or friend not found" });
    }

    if (user.friends.includes(friend_id) || friend.friends.includes(user_id)) {
      return res.status(400).json({ error: "Users are already friends" });
    }

    const userSentRequest = user.friendRequestsSent.includes(friend_id);
    const userReceivedRequest = user.friendRequestsReceived.includes(friend_id);
    const friendSentRequest = friend.friendRequestsSent.includes(user_id);
    const friendReceivedRequest =
      friend.friendRequestsReceived.includes(user_id);

    if (!userReceivedRequest && !friendReceivedRequest) {
      return res.status(400).json({ error: "Friend request does not exist" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await User.findByIdAndUpdate(
        user_id,
        {
          $pull: {
            friendRequestsReceived: friend_id,
            friendRequestsSent: friend_id,
          },
          $addToSet: { friends: friend_id }, // Add to friends list
        },
        { new: true, session } // Include session for transactional consistency
      );

      // Update friend's data: Add to friends, remove from requests
      await User.findByIdAndUpdate(
        friend_id,
        {
          $pull: {
            friendRequestsReceived: user_id,
            friendRequestsSent: user_id, // Remove any existing mutual request
          },
          $addToSet: { friends: user_id }, // Add to friends list
        },
        { new: true, session }
      );

      // Commit the transaction if all updates succeed
      await session.commitTransaction();
      session.endSession();
      const activeStatus = await redisClient.hget(
        `user:${friend_id}`,
        "active"
      );

      await notifyQueue.add("notification", {
        user_id: friend_id,
        topic: "ACCEPT_REQUEST",
        notification: {
          subject: "Accepted Request",
          request_data: {
            id: user._id,
            imageUrl: user.imageUrl,
            email: user.email,
          },
          message: "Friend Request Accepted..",
        },
      });
      res.status(200).json({
        message: "Friend request accepted successfully",
        active: activeStatus === "true",
      });
    } catch (transactionError) {
      // Roll back the transaction in case of any error
      await session.abortTransaction();
      session.endSession();

      console.error("Transaction error:", transactionError);
      res.status(500).json({ error: "Failed to accept friend request" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(400).json({ error: error.message });
  }
};

exports.removeFriend = async (req, res) => {
  console.log("Backend removeFriend");
  const { friend_id } = req.body; // Friend's ID from request body
  const user_id = req.user.userId; // User's ID from authentication middleware

  try {
    // Validate both user IDs
    validateObjectId(user_id);
    validateObjectId(friend_id);

    const user = await User.findById(
      user_id,
      "name email imageUrl friends blockedUsers"
    ).exec();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if the friend exists in the user's friend list
    if (!user.friends.includes(friend_id)) {
      return res
        .status(400)
        .json({ error: "The user is not in your friend list." });
    }

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // Remove friend from both users' friend lists
      const userUpdate = await User.findByIdAndUpdate(
        user_id,
        { $pull: { friends: friend_id } },
        { new: true, session }
      );

      const friendUpdate = await User.findByIdAndUpdate(
        friend_id,
        { $pull: { friends: user_id } },
        { new: true, session }
      );

      if (!userUpdate || !friendUpdate) {
        throw new Error("User or friend not found. Unable to remove.");
      }

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      await notifyQueue.add("notification", {
        topic: "REMOVE_FRIEND",
        user_id: friend_id,
        notification: {
          subject: "Remove Friend",
          request_data: {
            id: user._id,
            imageUrl: user.imageUrl,
            email: user.email,
          },
          message: "Remove form the Friend list...",
        },
      });

      res.status(200).json({ message: "Friend removed successfully" });
    } catch (transactionError) {
      // Roll back the transaction on error
      await session.abortTransaction();
      session.endSession();

      console.error("Transaction error:", transactionError);
      res.status(500).json({ error: "Failed to remove friend" });
    }
  } catch (error) {
    console.error("Error removing friend:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.rejectFriendRequest = async (req, res) => {
  const { friend_id } = req.body; // Get the friend's ID from the request body
  const user_id = req.user.userId; // Assuming req.user is populated by authentication middleware

  try {
    // Validate both user IDs
    validateObjectId(user_id);
    validateObjectId(friend_id);

    // Remove friend_id from user's friendRequestsReceived
    const userUpdate = await User.findByIdAndUpdate(
      user_id,
      { $pull: { friendRequestsReceived: friend_id } },
      { new: true }
    );

    // Remove user_id from friend's friendRequestsSent
    const friendUpdate = await User.findByIdAndUpdate(
      friend_id,
      { $pull: { friendRequestsSent: user_id } },
      { new: true }
    );

    if (!userUpdate || !friendUpdate) {
      return res.status(404).json({
        message: "User or Friend not found. Unable to reject request.",
      });
    }

    const user = await User.findById(user_id, "name email imageUrl ").exec();

    await notifyQueue.add("notification", {
      topic: "REJECT_REQUEST",
      user_id: friend_id,
      notification: {
        subject: "reject Friend Request",
        request_data: {
          id: user._id,
          imageUrl: user.imageUrl,
          email: user.email,
        },
        message: "Friend Request is Rejected ...",
      },
    });
    res.status(200).json({ message: "Friend request rejected successfully" });
  } catch (error) {
    console.error("Error rejecting friend request:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.blockingFriend = async (req, res) => {
  console.log("blocking Friend");
  const { friend_id } = req.body;
  const user_id = req.user.userId; // Assuming user_id is attached to req.user from authentication middleware

  try {
    // Validate friend_id and user_id
    validateObjectId(user_id);
    validateObjectId(friend_id);

    // Fetch user and friend's data
    const user = await User.findById(user_id, "blockedUsers friends").exec();
    const friend = await User.findById(friend_id, "friends").exec();

    if (!user || !friend) {
      return res.status(404).json({ error: "User or friend not found" });
    }

    // Check if the users are friends
    if (!user.friends.includes(friend_id)) {
      return res.status(400).json({ error: "Users are not in friend list" });
    }

    // Check if the friend is already blocked
    if (user.blockedUsers.includes(friend_id)) {
      return res.status(400).json({ error: "User is already blocked" });
    }

    // Start a session for the transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Block the friend by adding to `blockedUsers` and removing from `friends`
      await User.findByIdAndUpdate(
        user_id,
        {
          $addToSet: { blockedUsers: friend_id }, // Add to blocked users
        },
        { new: true, session }
      );

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        success: true,
        message: "User blocked successfully",
      });
    } catch (transactionError) {
      // Roll back the transaction in case of error
      await session.abortTransaction();
      session.endSession();

      console.error("Transaction error:", transactionError);
      res
        .status(500)
        .json({ success: false, error: "Failed to block the user" });
    }
  } catch (error) {
    console.error("Error blocking friend:", error);
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.unblockingFriend = async (req, res) => {
  console.log("unblocking the friend ");
  const { friend_id } = req.body;
  const user_id = req.user.userId; // Assuming user_id is attached to req.user from authentication middleware

  try {
    // Validate friend_id and user_id
    validateObjectId(user_id);
    validateObjectId(friend_id);

    // Fetch the user's data
    const user = await User.findById(user_id, "blockedUsers").exec();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if the friend is actually blocked
    if (!user.blockedUsers.includes(friend_id)) {
      return res.status(400).json({ error: "User is not blocked" });
    }

    // Start a session for the transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Unblock the friend by removing from `blockedUsers`
      await User.findByIdAndUpdate(
        user_id,
        {
          $pull: { blockedUsers: friend_id }, // Remove from blocked users
        },
        { new: true, session }
      );

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        success: true,
        message: "User unblocked successfully",
      });
    } catch (transactionError) {
      // Roll back the transaction in case of error
      await session.abortTransaction();
      session.endSession();

      console.error("Transaction error:", transactionError);
      res
        .status(500)
        .json({ success: false, error: "Failed to unblock the user" });
    }
  } catch (error) {
    console.error("Error unblocking friend:", error);
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.updateUserImage = async (req, res) => {
  try {
    // Ensure that the user is authenticated (assuming you use a middleware for authentication)
    const userId = req.user.userIdid; // Assuming `req.user` is populated by your auth middleware

    if (!req.file || !req.file.s3Url) {
      return res.status(400).json({ message: "Image upload failed." });
    }

    // Get the image URL from the S3 upload result
    const imageUrl = req.file.s3Url;

    // Find the user and update their imageUrl
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.imageUrl = imageUrl; // Save the image URL to the user document
    await user.save(); // Save the updated user document

    // Respond with the updated image URL
    res.status(200).json({
      message: "Profile image updated successfully.",
      imageUrl: imageUrl,
    });
  } catch (error) {
    console.error("Error updating user image:", error);
    res.status(500).json({ message: "Server error." });
  }
};

exports.updateUserEmail = async (req, res) => {
  try {
    const { newEmail, verificationToken } = req.body;
    const userId = req.user.userId;
    // Check if all required fields are provided
    if (!userId || !newEmail || !verificationToken) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Check if the new email is already in use
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already in use." });
    }

    // Find the user by their ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Check if the provided verification token matches and is not expired
    if (
      !crypto.timingSafeEqual(
        Buffer.from(user.verificationToken || ""),
        Buffer.from(verificationToken || "")
      )
    ) {
      return res.status(401).json({ message: "Invalid verification token." });
    }

    if (user.tokenExpiry < Date.now()) {
      return res
        .status(400)
        .json({ message: "Verification token has expired." });
    }

    // Update the user's email
    user.email = newEmail;
    user.isVerified = true; // Mark the user as unverified again
    user.verificationToken = undefined; // Clear the verification token
    user.tokenExpiry = undefined; // Clear the token expiry
    await user.save();

    return res.status(200).json({
      message: "Email updated successfully.",
    });
  } catch (error) {
    console.error("Error updating email:", error);
    res.status(500).json({ message: "Server error." });
  }
};

exports.updateUserdata = async (req, res) => {
  try {
    const { name, password } = req.body;

    const userId = req.user.userId;

    // Validate input existence
    if (!userId || (!name && !password)) {
      return res.status(400).json({
        message:
          "Missing required fields. Provide at least a name or password.",
      });
    }

    // Find the user in the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Update the name if provided
    if (name != user.name) {
      user.name = name;
    }

    // Update the password if provided
    if (password) {
      user.password = password;
    }

    // Save the updated user
    await user.save();

    res.status(200).json({
      message: "User data updated successfully!",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Error updating user data:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};
