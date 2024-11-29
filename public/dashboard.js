console.log("dashboard");
const API_BASE_URL = "http://localhost:3000/";
// Function to get a specific token from local storage
function getToken() {
  return localStorage.getItem("token");
}

const token = getToken(); // Retrieve the token
let friends = []; // Initialize friends as an empty array
let friendRequests = []; // Initialize friends as an empty array
let blocked__users = []; // Initialize friends as an empty array
let sentFriendRequests = []; // Initialize friends as an empty array
const incommingAudio = new Audio("/audio/incoming.mp3");

const friendsStatus = {}; // Maintain a local map of friends and their statuses
let socket = null;
// Check if the token is available, redirect if not
if (!token) {
  alert("You must be logged in to view this page.");
  window.location = "/login";
} else {
  // Initialize WebSocket connection
  socket = io("http://localhost:3000", {
    auth: { token }, // Pass the token for authentication
  });

  // Check if socket connection failed
  if (!socket) {
    alert("Connection error. Please log in again.");
    window.location = "/login";
  }
}

// Function to fetch user data
async function fetchBasicData() {
  try {
    const response = await fetch("http://localhost:3000/api/", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // Include token in the Authorization header
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch data. Please try again.");
    }

    const data = await response.json();
    console.log("Basic Data:", data); // Log the data

    friends = data.friends || []; // Assign friends data

    friendRequests = data.incomingFriendRequests || [];

    sentFriendRequests = data.sentFriendRequests || [];

    console.log("friendRequest", friendRequests);
    blocked__users = data.blocked__user || [];
    // Call function to populate the friend list
    populateFriendList(friends);
    populateFriendRequest();
  } catch (error) {
    console.error("Error:", error.message);
    alert("Error fetching data: " + error.message);
  }
}

function updateFriendsCount() {
  const membersCountElement = document.getElementById("members__count");

  if (membersCountElement) {
    membersCountElement.innerText = friends.length; // Update members count
  }
}
// Function to populate the friend list in the DOM
function populateFriendList(friends) {
  const friendListElement = document.getElementById("member__list");
  updateFriendsCount();

  if (friendListElement) {
    // Clear any existing content
    friendListElement.innerHTML = "";

    // Create a Set for blocked user IDs for efficient lookups
    const blockedUserSet = new Set(blocked__users.map((user) => user._id));
    console.log("blockedUserSet", blockedUserSet);

    // Loop through each friend and add to the list
    friends.forEach((friend) => {
      const friendElement = document.createElement("li");
      friendElement.className = "friend";
      friendElement.id = `friend-${friend._id}`;

      // Check if the friend is active and set the status
      const status = friend.active ? "online" : "offline";
      const isBlocked = blockedUserSet.has(String(friend._id));

      console.log("frieds", String(friend._id));
      console.log(isBlocked ? friend : "");
      // Create the friend card content dynamically
      friendElement.innerHTML = `
  <span class="friend-status ${status}" id="status-${friend._id}"></span>
  <span class="">${friend.name}</span>
  <div id="user-status-container-${friend._id}">
  ${
    isBlocked
      ? '<span class="blocked-tag">Blocked</span>'
      : status === "online"
      ? `<button class="call-button" onclick="OnclickCalling('${friend._id}')">Call</button>`
      : ""
  }
</div>
  <div class="dropdown">
    <button class="dropdown-toggle" id="dropdown-btn-${friend._id}">⋮</button>
    <ul class="dropdown-menu hidden" id="dropdown-menu-${friend._id}">
      <li><button onclick="removeFriend('${
        friend._id
      }')">Remove as Friend</button></li>
      <li>
        <button id="block-unblock-${friend._id}" 
  onclick="toggleBlockStatus('${friend._id}', ${isBlocked})">
  ${isBlocked ? "Unblock" : "Block"}
</button>
      </li>
    </ul>
  </div>
`;

      if (isBlocked) {
        updateBlockedUserList(friend._id, "add", isBlocked);
      }

      friendListElement.appendChild(friendElement);

      // Initialize each friend's status in the map
      friendsStatus[friend._id] = status;
    });
  }
}

function populateFriendRequest() {
  console.log("array of request", friendRequests);
  const friendRequestContainer = document.getElementById("incoming__requests");

  // Clear the existing content
  friendRequestContainer.innerHTML = "";

  // Check if there are any friend requests
  if (friendRequests.length === 0) {
    const noRequestsMessage = document.createElement("p");
    noRequestsMessage.textContent = "No friend requests.";
    friendRequestContainer.appendChild(noRequestsMessage);
    return;
  }

  // Iterate through the friendRequests array
  friendRequests.forEach((request) => {
    const requestElement = document.createElement("div");
    requestElement.className = "friend-request";
    requestElement.id = `friend-request-incoming-${request._id}`;
    requestElement.innerHTML = `
      <div class="friend-info" >
        <p><strong>${request.name}</strong> (${request.email})</p>
      </div>
      <div class="friend-actions">
        <button class="accept-btn" data-id="${request._id}">Accept</button>
        <button class="decline-btn" data-id="${request._id}">Decline</button>
      </div>
    `;

    friendRequestContainer.appendChild(requestElement);
  });

  // Attach event listeners to buttons
  const acceptButtons = document.querySelectorAll(".accept-btn");
  const declineButtons = document.querySelectorAll(".decline-btn");

  acceptButtons.forEach((button) => {
    button.addEventListener("click", () =>
      acceptFriendRequest(button.dataset.id)
    );
  });

  declineButtons.forEach((button) => {
    button.addEventListener("click", () =>
      rejectFriendRequest(button.dataset.id)
    );
  });
}

// Function to update friend status in the DOM
function updateFriendStatus(friendId, status) {
  const statusElement = document.getElementById(`status-${friendId}`);
  if (statusElement) {
    statusElement.className = `friend-status ${status}`;
    friendsStatus[friendId] = status;
    updateUserStatus(friend_id, false);
  }
}

let isBusy = false;

// Handle WebSocket connection events
socket.on("connect", () => {
  isBusy = false;
  console.log("Connected to server with socket ID:", socket.id);
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
});

socket.on("reconnect", (attemptNumber) => {
  console.log("Reconnected on attempt:", attemptNumber);
  // Optionally, re-fetch the latest friend statuses if needed
});

// Listen for online/offline events from the server
socket.on("user_online", (data) => {
  console.log(`User ${data.userId} is online`);
  updateFriendStatus(data.userId, "online");
});

socket.on("user_offline", (data) => {
  console.log(`User ${data.userId} is offline`);
  updateFriendStatus(data.userId, "offline");
});

socket.on("connect_error", (error) => {
  console.error("Connection failed:", error.message);
  if (error.message === "Authentication error: Invalid or expired token") {
    alert("Your session has expired. Please log in again.");
    window.location.href = "/login"; // Redirect to login
  }
});

socket.on("incoming_call", ({ fromUserId }) => {
  console.log(`Incoming call from user: ${fromUserId}`);
  showIncomingCallUI(fromUserId);
});

socket.on("call_answer", ({ fromUserId, payload }) => {
  peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
});

socket.on("user_busy", ({ message }) => {
  console.log(message);
  alert(message);
});

socket.on("call_rejected", ({ fromUserId }) => {
  console.log(`Call rejected by user: ${fromUserId}`);
  hideCallingUI();
  showbasicUI();
  showEndCallUI("Call Rejected by Receiver", fromUserId);
});

socket.on("call_ended", ({ fromUserId }) => {
  console.log(`Call ended by user: ${fromUserId}`);
  endCallUI();
});

// const startCall = async (toUserId) => {
//   socket.emit("start_call", { toUserId });
//   const offer = await peerConnection.createOffer();
//   await peerConnection.setLocalDescription(offer);

//   socket.emit("signaling", {
//     type: "offer",
//     toUserId,
//     payload: offer,
//   });
// };

const acceptCall = async (fromUserId, offer) => {
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit("signaling", {
    type: "answer",
    toUserId: fromUserId,
    payload: answer,
  });
};

const endCall = async (toUserId) => {
  socket.emit("end_call", { toUserId });
  peerConnection.close();
};

const rejectCall = (toUserId) => {
  socket.emit("reject_call", { toUserId });
};
// Fetch initial data
fetchBasicData();

console.log("Script loaded!");

const navLinks = document.querySelectorAll(".nav__link");
const contentSections = document.querySelectorAll(".content");

// Function to handle section visibility
function showSection(sectionId) {
  contentSections.forEach((section) => {
    if (section.id === sectionId) {
      section.classList.add("active");
    } else {
      section.classList.remove("active");
    }
  });

  navLinks.forEach((link) => {
    if (link.getAttribute("href").slice(1) === sectionId) {
      if (sectionId === "search-friends") {
        fetchFriends();
      }
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

// Add event listeners to navigation links
navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const targetSection = link.getAttribute("href").slice(1); // Get the section ID from href
    showSection(targetSection);
  });
});

// Show the default section on load (Home)
showSection("home");

let currentPage = 1;
let isLoading = false; // Prevent multiple simultaneous fetches
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
const cache = new Map(); // Cache for storing data

const searchInput = document.querySelector("#search-friends-input");
const friendListContainer = document.querySelector("#friend__list");

// Fetch friends from API or cache
async function fetchFriends(page = 1, query = "") {
  const cacheKey = `${query}-${page}`;
  const currentTime = Date.now();
  friendListContainer.innerHTML = "";
  // Check if data is in the cache and still valid
  if (cache.has(cacheKey) && query === "") {
    const cachedData = cache.get(cacheKey);
    if (currentTime - cachedData.timestamp < CACHE_DURATION) {
      console.log("Using cached data ...");
      renderFriends(cachedData.data);
      return;
    }
  }

  // Data not in cache or cache expired, fetch from server
  if (isLoading) return;
  isLoading = true;

  try {
    console.log("Fetching from server...");
    const response = await fetch(
      `/api/getSearchFriendsList?page=${page}&limit=30&query=${query}`
    );
    const { success, data } = await response.json();

    if (success) {
      renderFriends(data);
      if (query === "") {
        cache.set(cacheKey, { data, timestamp: currentTime }); // Save to cache
      }
    }
  } catch (err) {
    console.error("Error fetching friends:", err);
  } finally {
    isLoading = false;
  }
}

// Render friends in the container
function renderFriends(search_friends) {
  console.log("renderFrineds");
  const friendListDiv = document.getElementById("friend__list");

  console.log(friendListDiv);
  friendListDiv.innerHTML = ""; // or friendListDiv.replaceChildren();

  search_friends.forEach((friend) => {
    const friendElement = document.createElement("div");
    friendElement.className = "friend";
    friendElement.id = `search-${friend._id}`;

    // Create the action button
    const actionButton = createActionButton(friend);
    friendElement.textContent = friend.name; // Set the friend's name
    friendElement.appendChild(actionButton); // Append the action button

    // Append the friend element to the container
    friendListContainer.appendChild(friendElement);
  });
}

// Helper function to create the action button

// Handle search input
searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim();
  currentPage = 1; // Reset to first page
  friendListContainer.innerHTML = ""; // Clear existing list
  fetchFriends(currentPage, query); // Fetch filtered friends
});

// Infinite scroll logic
friendListContainer.addEventListener("scroll", () => {
  if (
    friendListContainer.scrollTop + friendListContainer.clientHeight >=
    friendListContainer.scrollHeight - 10 // Near bottom
  ) {
    currentPage++;
    const query = searchInput.value.trim();
    fetchFriends(currentPage, query); // Fetch next page
  }
});

// Helper function to create the action button dynamically
function createActionButton(friend) {
  const actionButton = document.createElement("button");
  actionButton.className = "friend-action";

  // Determine the relationship status and set button properties
  if (friends.some((request) => request._id === String(friend._id))) {
    actionButton.textContent = "Remove Friend";
    actionButton.onclick = () => removeFriend(friend._id);
  } else if (
    sentFriendRequests.some((request) => request._id === String(friend._id))
  ) {
    actionButton.textContent = "Cancel Request";
    actionButton.onclick = () => cancelFriendRequest(friend._id);
  } else {
    actionButton.textContent = "Add Friend";
    actionButton.onclick = () => sendFriendRequest(friend._id);
  }

  return actionButton;
}

// Function to send a friend request
async function sendFriendRequest(friend_id) {
  try {
    const response = await fetch(
      `http://localhost:3000/api/sendFriendRequest`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ friend_id }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to send the request. Please try again.");
    }

    // Update the button to "Cancel Request"
    updateFriendButton(friend_id, "cancelRequest");
    alert("Friend request sent successfully!");
  } catch (error) {
    console.error("Error:", error.message);
    alert("Error sending request: " + error.message);
  }
}

// Function to cancel a friend request
async function cancelFriendRequest(friend_id) {
  console.log(`${API_BASE_URL}`);
  try {
    const response = await fetch(`${API_BASE_URL}api/cancelFriendRequest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ friend_id }),
    });

    if (!response.ok) {
      throw new Error("Failed to cancel the friend request.");
    }

    // Update the button to "Add Friend"
    updateFriendButton(friend_id, "addFriend");
    alert("Friend request canceled successfully!");
  } catch (error) {
    console.error("Error:", error.message);
    alert("Error canceling friend request: " + error.message);
  }
}

// Accept Friend Request
async function acceptFriendRequest(friend_id) {
  console.log("acceptFriendRequest", friend_id);
  try {
    const response = await fetch(`${API_BASE_URL}api/acceptFriendRequest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ friend_id }),
    });

    if (!response.ok) {
      throw new Error(
        "Failed to accept the friend request. " + response.stringify
      );
    }
    const friendRequestContainer =
      document.getElementById("incoming__requests");
    const requestElement = document.getElementById(
      `friend-request-incoming-${friend_id}`
    );
    if (requestElement) {
      friendRequestContainer.removeChild(requestElement);
    }

    const responseData = await response.json(); // Parse the JSON response
    console.log("Response Data:", responseData);
    const requested_friend = friendRequests.find(
      (friend) => friend._id == friend_id
    );

    console.log("requested_friend", responseData.active);
    let temp = [];
    requested_friend.active = responseData.active;
    temp.push(requested_friend);
    console.log(requested_friend);
    friends.push(requested_friend);
    console.log(friends);
    friendRequests = friendRequests.filter(
      (friend) => friend._id !== friend_id
    );

    populateFriendList(temp);
    alert("Friend request accepted successfully!");
  } catch (error) {
    console.error("Error:", error.message);
    alert("Error accepting friend request: " + error.message);
  }
}

// Function to remove a friend
// Remove Friend
async function removeFriend(friend_id) {
  console.log("in removeFriend api ");
  try {
    const response = await fetch(`${API_BASE_URL}api/removeFriend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ friend_id }),
    });

    if (!response.ok) {
      throw new Error("Failed to remove friend.");
    }

    removeFromFriendList(friend_id);
    // Update the button to "Add Friend"
    updateFriendButton(friend_id, "addFriend");
    alert("Friend removed successfully!");
  } catch (error) {
    console.error("Error:", error.message);
    alert("Error removing friend: " + error.message);
  }
}

// Cancel Incoming Friend Request
async function rejectFriendRequest(friend_id) {
  try {
    const response = await fetch(`${API_BASE_URL}api/rejectFriendRequest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ friend_id }),
    });

    if (!response.ok) {
      throw new Error("Failed to cancel the incoming friend request.");
    }

    const friendRequestContainer =
      document.getElementById("incoming__requests");
    const requestElement = document.getElementById(
      `friend-request-incoming-${friend_id}`
    );
    if (requestElement) {
      friendRequestContainer.removeChild(requestElement);
    }
    friendRequests = friendRequests.filter(
      (friend) => friend._id !== friend_id
    );
    console.log(friendRequests);
    // Update the button to "Add Friend"
    alert(" successfully rejected the request ....");
  } catch (error) {
    console.error("Error:", error.message);
    alert("Error canceling incoming request: " + error.message);
  }
}

async function blockFriend(friend_id) {
  try {
    const response = await fetch(`${API_BASE_URL}api/blockFriend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ friend_id }),
    });

    if (!response.ok) {
      throw new Error("Failed to block the friend.");
    }

    const blockedContainer = document.getElementById("blocked__users");
    const friendElement = document.getElementById(`friend-${friend_id}`);

    if (friendElement) {
      // Remove the friend from the current list (e.g., friends list or incoming requests)
      friendElement.remove();
    }

    // Optionally update a separate UI container for blocked users
    if (blockedContainer) {
      const blockedElement = document.createElement("div");
      blockedElement.id = `blocked-friend-${friend_id}`;
      blockedElement.innerHTML = `
                <span>${friend_id}</span>
                <button onclick="unblockFriend('${friend_id}')">Unblock</button>
            `;
      blockedContainer.appendChild(blockedElement);
    }

    alert("Successfully blocked the user.");
  } catch (error) {
    console.error("Error blocking friend:", error.message);
    alert("Error blocking friend: " + error.message);
  }
}

async function toggleBlockStatus(friend_id, isBlocked) {
  console.log("toggleBlockStatus...");
  console.log(friend_id, isBlocked);
  try {
    const endpoint = isBlocked ? "api/unblockingFriend" : "api/blockingFriend";
    const action = isBlocked ? "unblock" : "block";

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ friend_id }),
    });
    console.log("respose", `${API_BASE_URL}${endpoint}`, response);
    if (!response.ok) {
      throw new Error(`Failed to ${action} the user.`);
    }

    // Toggle the button state and text dynamically
    const button = document.getElementById(`block-unblock-${friend_id}`);
    if (button) {
      button.innerHTML = isBlocked ? "Block" : "Unblock";
      button.setAttribute(
        "onclick",
        `toggleBlockStatus('${friend_id}', ${!isBlocked})`
      );
    }

    if (!isBlocked) {
      blocked__users.push(friend_id);
      updateBlockedUserList(friend_id, "add", !isBlocked);
    } else {
      blocked__users = blocked__users.filter((user) => user._id !== friend_id);
      console.log("current me kya h", isBlocked);
      updateBlockedUserList(friend_id, "remove", !isBlocked);
    }

    alert(`Successfully ${isBlocked ? "unblocked" : "blocked"} the user.`);
  } catch (error) {
    console.error(
      `Error trying to ${isBlocked ? "unblock" : "block"} user:`,
      error
    );
    alert(`Error: ${error.message}`);
  }
}

function updateBlockedUserList(friend_id, action, isBlocked) {
  console.log("updateBlockedUserList", action, isBlocked);
  const blockedContainer = document.getElementById("blocked__users");

  const friend = friends.find((friend) => friend._id == friend_id);

  const name = friend ? friend.name : null; // Return the name if friend is found, otherwise null

  if (action === "add") {
    if (blockedContainer) {
      const blockedElement = document.createElement("div");
      blockedElement.id = `blocked-friend-${friend_id}`;
      blockedElement.className = "friend";
      blockedElement.innerHTML = `
          <span>${name}</span>
          <button  
            onclick="toggleBlockStatus('${friend_id}', ${isBlocked})">
            Unblock
          </button>
      `;
      blockedContainer.appendChild(blockedElement);
    }
  } else if (action === "remove") {
    // Remove the blocked user element
    const blockedElement = document.getElementById(
      `blocked-friend-${friend_id}`
    );
    if (blockedElement) {
      blockedContainer.removeChild(blockedElement);
    }
  }

  updateUserStatus(friend_id, isBlocked);
}

function updateUserStatus(friend_id, isBlocked) {
  console.log("updateUserStatus", friend_id, isBlocked);
  const container = document.getElementById(
    `user-status-container-${friend_id}`
  );

  if (!container) {
    console.log("error in updateUserStatus");
    return;
  }
  const status = friendsStatus[friend_id];
  console.log("status", status);
  if (isBlocked) {
    container.innerHTML = '<span class="blocked-tag">Blocked</span>';
  } else if (status == "online") {
    console.log("btton online ");
    container.innerHTML = `<button class="call-button" onclick="OnclickCalling('${friend_id}')">Call</button>`;
  } else {
    container.innerHTML = ""; // Clear content for other statuses
  }
}

// Function to update the friend action button dynamically
function updateFriendButton(friend_id, actionType) {
  const element = document.getElementById(`search-${friend_id}`);
  if (!element) return;

  // Remove the existing action button
  const oldButton = element.querySelector(".friend-action");
  if (oldButton) oldButton.remove();

  // Create the new action button
  const newButton = document.createElement("button");
  newButton.className = "friend-action";

  if (actionType === "addFriend") {
    newButton.textContent = "Add Friend";
    newButton.onclick = () => sendFriendRequest(friend_id);
  } else if (actionType === "cancelRequest") {
    newButton.textContent = "Cancel Request";
    newButton.onclick = () => cancelFriendRequest(friend_id);
  } else if (actionType === "removeFriend") {
    newButton.textContent = "Remove Friend";
    newButton.onclick = () => removeFriend(friend_id);
  }

  // Append the new button to the friend element
  element.appendChild(newButton);
}

function removeFromFriendList(friend_id) {
  document.getElementById(`friend-${friend_id}`).innerHTML = "";

  if (blocked__users.includes(String(friend_id))) {
    console.log("yes it is blocked");
  }
  updateFriendsCount();
}

document.addEventListener("click", (event) => {
  // Close any open dropdowns if clicking outside
  const openMenus = document.querySelectorAll(".dropdown-menu.visible");
  console.log(openMenus);
  console.log("drop it ");
  openMenus.forEach((menu) => {
    if (!menu.parentElement.contains(event.target)) {
      menu.classList.remove("visible");
      menu.classList.add("hidden");
    }
  });

  // Toggle the clicked dropdown menu
  if (event.target.classList.contains("dropdown-toggle")) {
    const menuId = event.target.getAttribute("id").replace("dropdown-btn-", "");
    const dropdownMenu = document.getElementById(`dropdown-menu-${menuId}`);
    if (dropdownMenu) {
      dropdownMenu.classList.toggle("hidden");
      dropdownMenu.classList.toggle("visible");
    }
  }
});
function OnclickCalling(friendId) {
  console.log(`Calling friend with ID: ${friendId}`);

  // Select all elements with the class "call-button"
  hidebasicUI();

  const friend = friends.find((friend) => friend._id == friendId);
  console.log("findind frind", friend);

  document.getElementById("basic-ui").classList.add("content");
  document.getElementById("calling-ui").classList.remove("content");

  //   document.getElementById("incoming-status").classList.add("content");

  Calling(friend);

  document
    .getElementById("cancel-call-button")
    .addEventListener("click", () => {
      // Notify server of call cancellation
      socket.emit("cancel_call", { toUserId: friendId });

      // Hide calling UI
      stopMediaTracks();
      //   toggleMic();
      hideCallingUI();
      showbasicUI();
      // Show notification of call cancellation
      //   alert("Call cancelled.");
    });
}

// function cancelCall() {
//   //   alert("Call cancelled!");

//   socket.emit("cancel_call", { toUserId: "user2Id" });

//   // Hide calling UI
//   hideCallingUI();

//   // Show notification of call cancellation
//   alert("Call cancelled.");
// }

//sockets

let uid = sessionStorage.getItem("uid");
if (!uid) {
  uid = String(Math.floor(Math.random() * 10000));
  sessionStorage.setItem("uid", uid);
}

let localTracks = [];
let localStream;
let remoteUsers = {};
let peerConnection;
let localScreenTracks;
let sharingScreen = false;
let userIdInDisplayFrame = null;
const constraint = {
  video: {
    width: {
      min: 640,
      ideal: 1920,
      max: 1920,
    },
    height: {
      min: 480,
      ideal: 1080,
      max: 1080,
    },
  },
  audio: true,
};
// ICE Servers Configuration
const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

// UI Event Handlers
const chatContainer = document.getElementById("messages__container");
const chatButton = document.getElementById("chat__button");
const memberContainer = document.getElementById("members__container");
const memberButton = document.getElementById("members__button");
const displayFrame = document.getElementById("stream__box");
const videoFrames = document.getElementsByClassName("video__container");

let activeChatContainer = false;
let activeMemberContainer = false;

// chatButton.addEventListener("click", () => {
//   chatContainer.style.display = activeChatContainer ? "none" : "block";
//   activeChatContainer = !activeChatContainer;
// });

memberButton.addEventListener("click", () => {
  memberContainer.style.display = activeMemberContainer ? "none" : "block";
  activeMemberContainer = !activeMemberContainer;
});

// Socket.IO Event Handlers
// socket.on("connect", () => {
//   console.log("Connected to the server:", socket.id);
//   socket.emit("join_room", { roomId, displayName });
// });

socket.on("incoming_offer", async ({ fromUserId, offer }) => {
  console.log("Incoming offer from:", fromUserId);
  IncomingCallUI(fromUserId, offer);
});

socket.on("call_cancelled", ({ fromUserId }) => {
  console.log(`Call cancelled by ${fromUserId}`);

  hideIncomingCallUI();

  setTimeout(() => {
    showMissedCallUI(fromUserId);
  }, 1000);

  // Show missed call notification

  // Hide incoming call UI
});

const getFriendFromFriends = (friend_id) => {
  return friends.find((friend) => friend._id == friend_id);
};
// Show Missed Call UI
function showMissedCallUI(fromUserId) {
  console.log("showMissedCallUI ...");
  const missedCallContainer = document.getElementById("missed-call-container");
  const missedCallMessage = document.getElementById("missed-call-message");
  const callAgainButton = document.getElementById("call-again-button");

  const friend = getFriendFromFriends(fromUserId);
  callAgainButton.innerHTML = "";
  callAgainButton.innerHTML = `<button class=" return-call-btn" onclick="OnclickCalling('${fromUserId}')">Call</button>`;

  missedCallMessage.textContent = `Missed call from User ${friend.name}`;
  missedCallContainer.style.display = "";
}

// Hide Missed Call UI
function hideMissedCallUI() {
  const missedCallContainer = document.getElementById("missed-call-container");
  missedCallContainer.style.display = "none";
}

// Handle Missed Call Dismiss
document
  .getElementById("dismiss-missed-call-btn")
  .addEventListener("click", hideMissedCallUI);

socket.on("answer_received", async ({ answer, fromUserId }) => {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(answer);
    console.log("Answer set successfully.");

    socket.emit("answer_set_ack", {
      toUserId: fromUserId, // Caller ID
      message: "Answer has been set successfully",
    });
    hideCallingUI();
  }
});

socket.on("answer_acknowledged", ({ message }) => {
  console.log("answer_acknowledged", message); // Display the acknowledgment message

  const acceptCallBtn = document.getElementById("accept-call-btn");
  acceptCallBtn.disabled = false;
  hideIncomingCallUI();
  hidebasicUI();
});

const hidebasicUI = () => {
  const callButtons = document.querySelectorAll(".call-button");

  // Loop through each button and add the "content" class
  callButtons.forEach((button) => {
    button.classList.add("content");
  });

  document.getElementById("basic-ui").style.display = "none";
  document.getElementById("calling-ui").style.display = "block";
};

const showbasicUI = () => {
  const callButtons = document.querySelectorAll(".call-button");

  // Loop through each button and add the "content" class
  callButtons.forEach((button) => {
    button.classList.remove("content");
  });
  document.getElementById("calling-ui").style.display = "none";
  document.getElementById("basic-ui").style.display = "block";
};

socket.on("ice_candidate", async ({ candidate }) => {
  if (peerConnection) {
    await peerConnection.addIceCandidate(candidate);
    console.log("ICE Candidate added.");
  }
});

socket.on("call_busy", ({ message }) => {
  alert(message);
});

// Chat
socket.on("receive_message", ({ from, message }) => {
  addMessageToDom(from, message);
});

socket.on("member_left", ({ uid }) => {
  document.getElementById(`user-container-${uid}`)?.remove();
  console.log(`User ${uid} left the room.`);
});

socket.on("offer_acknowledged", ({ fromUserId }) => {
  console.log(`Receiver ${fromUserId} acknowledged the offer.`);
  document.getElementById("caller-status").textContent = "Ringing...";
});

// Functions for Call Management
const createPeerConnection = async (toUserId) => {
  peerConnection = new RTCPeerConnection(servers);

  // Add local tracks
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia(constraint);
    document.getElementById("user-1").srcObject = localStream;
  }

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  // Handle remote tracks
  peerConnection.ontrack = (event) => {
    const remoteStream = new MediaStream();
    remoteStream.addTrack(event.track);
    document.getElementById("user-2").srcObject = remoteStream;
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice_candidate", {
        toUserId,
        candidate: event.candidate,
      });
    }
  };
};

const createOffer = async (toUserId) => {
  console.log("createOffer", toUserId);
  await createPeerConnection(toUserId);

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit("send_offer", { toUserId, offer });
};

const createAnswer = async (fromUserId, offer) => {
  await createPeerConnection(fromUserId);

  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  return answer;
};

socket.on("receive_candidate", async (data) => {
  const { fromUserId, candidate } = data;
  console.log(`Received ICE candidate from user: ${fromUserId}`);
  const iceCandidate = new RTCIceCandidate(candidate);
  await peerConnection.addIceCandidate(iceCandidate);
});

// Join Room
const joinRoom = async () => {
  localTracks = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  document.getElementById("user-1").srcObject = localTracks;

  document.getElementById("join-btn").style.display = "none";
  document.getElementById("leave-btn").style.display = "block";

  const player = `<div class="video__container" id="user-container-${uid}">
    <div class="video-player" id="user-${uid}"></div>
  </div>`;

  document
    .getElementById("streams__container")
    .insertAdjacentHTML("beforeend", player);
  document
    .getElementById(`user-container-${uid}`)
    .addEventListener("click", expandVideoFrame);

  socket.emit("join_call", { roomId, uid });
};

// Leave Room
const leaveRoom = async () => {
  localTracks.forEach((track) => track.stop());
  socket.emit("leave_call", { roomId, uid });

  document.getElementById("join-btn").style.display = "block";
  document.getElementById("leave-btn").style.display = "none";
};

// Expand Video Frame
const expandVideoFrame = (e) => {
  const child = displayFrame.children[0];
  if (child) {
    document.getElementById("streams__container").appendChild(child);
  }

  displayFrame.style.display = "block";
  displayFrame.appendChild(e.currentTarget);
  userIdInDisplayFrame = e.currentTarget.id;

  Array.from(videoFrames).forEach((frame) => {
    frame.style.height = frame.id !== userIdInDisplayFrame ? "100px" : "300px";
  });
};

displayFrame.addEventListener("click", () => {
  displayFrame.style.display = null;
  Array.from(videoFrames).forEach((frame) => {
    frame.style.height = "300px";
  });
});

// UI Event Listeners
document.getElementById("join-btn").addEventListener("click", joinRoom);
document.getElementById("leave-btn").addEventListener("click", leaveRoom);

document.getElementById("camera-btn").addEventListener("click", async () => {
  const videoTrack = localTracks
    .getTracks()
    .find((track) => track.kind === "video");
  videoTrack.enabled = !videoTrack.enabled;
});

document.getElementById("mic-btn").addEventListener("click", async () => {
  const audioTrack = localTracks
    .getTracks()
    .find((track) => track.kind === "audio");
  audioTrack.enabled = !audioTrack.enabled;
});

// Chat Message
document
  .getElementById("message__form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = e.target.message.value;
    socket.emit("send_message", { roomId, message });
    addMessageToDom("You", message, true);
    e.target.reset();
  });

let callingAudio = null;

const Calling = async (user) => {
  console.log("calling...");
  await createOffer(user._id);
  // Play calling audio
  hidebasicUI();
  showCallingUI(user);
};

const IncomingCallUI = async (user_id, offer) => {
  // Show the incoming call UI

  console.log("IncomingCallUI", user_id);
  const incomingCallModal = document.getElementById("incoming-call");
  document.getElementById("caller-name-text").textContent = user_id;
  incomingCallModal.style.display = "flex";

  // Send acknowledgment to the caller that the offer is received
  socket.emit("offer_received_ack", { fromUserId: user_id });

  // Handle Accept Call
  document.getElementById("accept-call-btn").onclick = async () => {
    const acceptCallBtn = document.getElementById("accept-call-btn");
    acceptCallBtn.disabled = true;

    const answer = await createAnswer(user_id, offer);
    socket.emit("send_answer", { toUserId: user_id, answer });
  };

  // Handle Reject Call
  document.getElementById("reject-call-btn").onclick = () => {
    console.log("call_rejected...");
    socket.emit("call_rejected", { toUserId: user_id });
    hideIncomingCallUI();
  };

  if (incommingAudio) {
    incommingAudio.loop = true; // Loop the audio while the call is ringing
    incommingAudio
      .play()
      .catch((err) => console.error("Audio play error:", err));
  }
};

function hideIncomingCallUI() {
  const incomingCallModal = document.getElementById("incoming-call");
  incomingCallModal.style.display = "none"; // Hide the UI
  if (incommingAudio) {
    incommingAudio.pause();
    incommingAudio.currentTime = 0; // Reset to the beginning
    // incommingAudio = null; // Cleanup
  }
}

function showEndCallUI(message, friend_id) {
  // Update the message and caller image
  console.log("showing end call ui ...");
  const incomingCallModal = document.getElementById("incoming-call");

  incomingCallModal.style.display = "none";

  const friend = friends.find((friend) => friend._id !== friend_id);

  document.getElementById("end-call-message").textContent = message;
  document.getElementById("end-call-image").src =
    false || "https://via.placeholder.com/100";

  // Show the end call UI
  document.getElementById("end-call").style.display = "flex";

  document
    .getElementById("close-end-call-btn")
    .addEventListener("click", hideEndCallUI);

  // Retry the call
  document.getElementById("go-back-call-btn").addEventListener("click", () => {
    hideEndCallUI();
    OnclickCalling(friend_id);
  });
}

function hideEndCallUI() {
  document.getElementById("end-call").style.display = "none";
}

const showCallingUI = (user) => {
  document.getElementById("calling-status").style.display = "block";
  // Update caller details
  document.getElementById("caller-name").textContent = user.name;
  console.log(document.getElementById("caller-name").textContent);
  document.getElementById("caller-status").textContent = "Calling...";
  document.getElementById("caller-image").src =
    user.image || "https://via.placeholder.com/100";
  document.getElementById("calling-status").style.display = "flex";

  if (!callingAudio) {
    console.log(callingAudio);

    callingAudio = new Audio("/audio/calling-tone.mp3"); // Path to your calling tone file
    console.log("after", callingAudio);

    callingAudio.loop = true; // Loop the audio while the call is ringing
    callingAudio.play().catch((err) => console.error("Audio play error:", err));
  }
};

function hideCallingUI() {
  document.getElementById("calling-status").style.display = "none";
  //calling-status

  // Stop the audio
  if (callingAudio) {
    callingAudio.pause();
    callingAudio.currentTime = 0; // Reset to the beginning
    callingAudio = null; // Cleanup
  }
}

//for room
let handleMemberLeft = async (MemberId) => {
  removeMemberFromDom(MemberId);
  let member = await channel.getMembers();
  updateMemberTotal(member);

  let { name } = await rtmClient.getUserAttributesByKeys(MemberId, ["name"]);
  addBotMessageToDom(`Welcome to the room ${name}! 👋`);
};

let handleUserLeft = async (user) => {
  delete remoteUsers[user.id];
  let item = document.getElementById(`user-container-${user.id}`);

  if (item) {
    item.remove();
  }

  if (userIdInDisplayFrame === user.id) {
    displayFrame.style.display = null;

    let videoFrames = document.getElementById("video__container");

    for (let i = 0; videoFrames.length > i; i++) {
      videoFrames[i].style.height = "300px";
      videoFrames[i].style.width = "300px";
    }
  }
};

let toggleCamera = async (e) => {
  console.log("camera");

  let button = e.currentTarget;
  console.log("Toggle camera called. Muted:", localTracks[1]?.muted);

  if (localTracks[1]) {
    if (localTracks[1].muted) {
      console.log("Unmuting camera...");
      await localTracks[1].setMuted(false);
      button.classList.add("active");
    } else {
      console.log("Muting camera...");
      await localTracks[1].setMuted(true);
      button.classList.remove("active");
    }
    console.log("Camera status changed. Now muted:", localTracks[1].muted);
  } else {
    console.error("Camera track not found.");
  }
};

let toggleMic = async (e) => {
  console.log("mic");
  let button = e.currentTarget;
  console.log("mic");
  if (localTracks[0]) {
    if (localTracks[1].muted) {
      await localTracks[0].setMuted(false);
      button.classList.add("active");
    } else {
      await localTracks[0].setMuted(true);
      button.classList.remove("active");
    }
  } else {
    console.error("audio track not found.");
  }
};

let toggleScreen = async (e) => {
  let screenButton = e.currentTarget;
  let cameraButton = document.getElementById("camera-btn");

  if (!sharingScreen) {
    console.log("screen");

    sharingScreen = true;
    screenButton.classList.add("active");
    cameraButton.classList.remove("active");
    cameraButton.style.display = "none";

    localScreenTracks = await AgoraRTC.createScreenVideoTrack();

    document.getElementById(`user-container-${uid}`).remove();
    displayFrame.style.display = "block";

    let player = `<div class="video__container" id="user-container-${uid}">
      <div class="video-player" id="user-${uid}"></div>
    </div>`;

    displayFrame.insertAdjacentHTML("beforeend", player);

    document
      .getElementById(`user-container-${uid}`)
      .addEventListener("click", expandVideoFrame);

    userIdInDisplayFrame = `user-container-${uid}`;

    localScreenTracks.play(`user-${uid}`);

    await client.unpublish([localTracks[1]]);
    await client.publish([localScreenTracks]);

    let videoFrames = document.getElementsByClassName("video__container");

    console.log("screen");
    for (let i = 0; videoFrames.length > i; i++) {
      if (videoFrames[i].id != userIdInDisplayFrame) {
        videoFrames[i].style.height = "100px";
        videoFrames[i].style.width = "100px";
      }
    }
  } else {
    sharingScreen = false;
    cameraButton.style.display = "block";

    document.getElementById(`user-container-${uid}`).remove();

    await client.unpublish([localScreenTracks]);

    switchToCamera();
  }
};

let switchToCamera = async () => {
  let player = `<div class="video__container" id="user-container-${uid}">
      <div class="video-player" id="user-${uid}"></div>
    </div>`;

  displayFrame.insertAdjacentHTML("beforeend", player);

  await localTracks[0].setMuted(true);
  await localTracks[1].setMuted(true);

  document.getElementById("mic-btn").classList.remove("active");
  document.getElementById("screen-btn").classList.remove("active");

  localTracks[1].play(`user-${uid}`);

  await client.publish([localTracks[1]]);
};

let joinStream = async () => {
  // init();
  // document.getElementById("join-btn").style.display = "none";
  // document.getElementById("leave-btn").style.display = "block";

  let player = `<div class="video__container" id="user-container-${uid}">
    <div class="video-player" id="user-${uid}"></div>
  </div>`;

  document
    .getElementById("streams__container")
    .insertAdjacentHTML("beforeend", player);

  document
    .getElementById(`user-container-${uid}`)
    .addEventListener("click", expandVideoFrame);
  localTracks[1].play(`user-${uid}`);

  await client.publish([localTracks[0], localTracks[1]]);
};

async function createMicrophoneAndCameraTracks(
  audioConfig = {}, // Audio configuration
  videoConfig = { width: 640, height: 480, frameRate: 30 } // Video configuration
) {
  try {
    console.info("Requesting media devices with config:", {
      audioConfig,
      videoConfig,
    });

    // Get user media stream with audio and video
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConfig,
      video: videoConfig,
    });

    // Extract audio and video tracks
    const audioTrack = mediaStream.getAudioTracks()[0];
    const videoTrack = mediaStream.getVideoTracks()[0];

    // Validate tracks
    if (!audioTrack || !videoTrack) {
      throw new Error("Failed to create audio or video track.");
    }

    console.info("Successfully created audio and video tracks:", {
      audioTrack,
      videoTrack,
    });

    // Return tracks
    return [audioTrack, videoTrack];
  } catch (error) {
    console.error("Error creating microphone and camera tracks:", error);
    throw error;
  }
}

const stopMediaTracks = () => {
  // Stop the local audio and video tracks
  localStream.getTracks().forEach((track) => {
    track.stop(); // Stop the track and release the resource
  });

  // Optionally, set the video element's srcObject to null
  document.getElementById("user-1").srcObject = null;
};

document.getElementById("camera-btn").addEventListener("click", toggleCamera);

document.getElementById("mic-btn").addEventListener("click", toggleMic);

document.getElementById("screen-btn").addEventListener("click", toggleScreen);

document.getElementById("join-btn").addEventListener("click", joinStream);

document.getElementById("leave-btn").addEventListener("click", leaveStream);
