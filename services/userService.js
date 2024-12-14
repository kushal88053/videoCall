const User = require("../model/users.model");

async function getFriendsFromDb(userId) {
  console.log(userId);
  try {
    // Find the user by their ID and populate the "friends" field
    const user = await User.findById(userId).populate(
      "friends",
      "name email imageUrl"
    );

    console.log("user", user);
    // If the user or their friends list is not found, return an empty array
    if (!user || !user.friends) {
      return [];
    }

    // Return the populated friends' information
    return user.friends;
  } catch (error) {
    console.error("Error fetching friends from the database:", error);
    return [];
  }
}
