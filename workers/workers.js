const { createBullClient } = require("./redisClient"); // Assuming createBullClient is a function to create the Redis client

// Define the two queues
const callQueue = new Queue("callQueue", { createClient: createBullClient });
const notifyQueue = new Queue("notifyQueue", {
  createClient: createBullClient,
});

// Process "terminateCall" jobs from callQueue
callQueue.process("terminateCall", async (job) => {
  const { userId, disconnectTimestamp } = job.data;

  // Handle the termination logic
  console.log(
    `Processing terminateCall for user: ${userId}, disconnectTimestamp: ${disconnectTimestamp}`
  );

  // Example action: Notify other parts of the system about the termination (e.g., close call, log out user)
  await handleCallTermination(userId, disconnectTimestamp);

  return `Call terminated for user: ${userId}`;
});

// Process "notifyFriends" jobs from notifyQueue
notifyQueue.process("notifyFriends", async (job) => {
  const { userId, disconnectTimestamp } = job.data;

  // Handle the notification logic
  console.log(
    `Processing notifyFriends for user: ${userId}, disconnectTimestamp: ${disconnectTimestamp}`
  );

  // Example action: Notify friends about the user disconnecting
  await notifyFriendsOfDisconnection(userId, disconnectTimestamp);

  return `Notified friends of user: ${userId} disconnection`;
});

// Example helper function for call termination (your business logic)
async function handleCallTermination(userId, disconnectTimestamp) {
  // Your logic for terminating the call, e.g., closing the user's session
  console.log(`Terminating call for user ${userId} at ${disconnectTimestamp}`);
}

// Example helper function for notifying friends (your business logic)
async function notifyFriendsOfDisconnection(userId, disconnectTimestamp) {
  // Your logic for notifying friends about the user's disconnection
  console.log(
    `Notifying friends of user ${userId} disconnect at ${disconnectTimestamp}`
  );
}
