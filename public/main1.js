let uid = sessionStorage.getItem("uid");
if (!uid) {
  uid = String(Math.floor(Math.random() * 10000));
  sessionStorage.setItem("uid", uid);
}

// let roomId = new URLSearchParams(window.location.search).get("room") || "main";
// let displayName = new URLSearchParams(window.location.search).get("name");

// if (!displayName) {
//   window.location = "/";
// }

let localTracks = [];
let remoteUsers = {};
let peerConnection;
let localScreenTracks;
let sharingScreen = false;
let userIdInDisplayFrame = null;

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
socket.on("connect", () => {
  console.log("Connected to the server:", socket.id);
  socket.emit("join_room", { roomId, displayName });
});

socket.on("incoming_offer", async ({ fromUserId, offer }) => {
  console.log("Incoming offer from:", fromUserId);

  // Check busy status

  const incoming_friend = friends.find((friend) => friend._id == fromUserId);
  const acceptCall = confirm(`${incoming_friend.name} is calling you. Accept?`);
  if (!acceptCall) {
    socket.emit("reject_call", { fromUserId });
    return;
  }

  const answer = await createAnswer(fromUserId, offer);
  socket.emit("send_answer", { toUserId: fromUserId, answer });
});

socket.on("answer_received", async ({ answer }) => {
  console.log("answer", answer);
  if (peerConnection) {
    await peerConnection.setRemoteDescription(answer);
    console.log("Answer set successfully.");
  }
});

socket.on("ice_candidate", async ({ candidate }) => {
  if (peerConnection) {
    await peerConnection.addIceCandidate(candidate);
    console.log("ICE Candidate added.");
  }
});

socket.on("call_busy", ({ message }) => {
  hideCallingUI();
  showbasicUI();
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

// Functions for Call Management
const createPeerConnection = async (toUserId) => {
  peerConnection = new RTCPeerConnection(servers);

  // Add local tracks
  localTracks.forEach((track) => peerConnection.addTrack(track));

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

// let callingAudio = null;

// const startCall = async (user) => {
//   console.log("calling...");
//   // Update caller details
//   document.getElementById("caller-name").textContent = user.name;
//   document.getElementById("caller-status").textContent = "Calling...";
//   document.getElementById("caller-image").src =
//     user.image || "https://via.placeholder.com/100";
//   document.getElementById("calling-status").style.display = "flex";

//   console.log(user._id);
//   await createOffer(user._id);
//   // Play calling audio
//   if (!callingAudio) {
//     console.log(callingAudio);

//     callingAudio = new Audio("/audio/calling-tone.mp3"); // Path to your calling tone file
//     console.log("after", callingAudio);

//     callingAudio.loop = true; // Loop the audio while the call is ringing
//     callingAudio.play().catch((err) => console.error("Audio play error:", err));
//   }
// };
