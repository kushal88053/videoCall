const APP_ID = "c2e45f74aae841e48403aa6c3fb4cf9a";
let uid = String(Math.floor(Math.random() * 10000));
let token;

let querySrting = window.location.search;
let urlParams = new URLSearchParams(querySrting);
let roomId = urlParams.get("room");

if (!roomId) {
  window.location = "lobby.html";
}

const fetchToken = async (uid) => {
  try {
    const response = await axios.get(
      `http://localhost:3000/generate-token?uid=${uid}`
    );
    return response.data.token;
  } catch (error) {
    console.error("Error fetching token:", error);
    return null;
  }
};
let client;
let channel;
let localStream;
let remoteStream;
const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};
const { RTM } = AgoraRTM;
let peerConnection;

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
let init = async () => {
  token = await fetchToken(uid);

  console.log("get the token", token);

  localStream = await navigator.mediaDevices.getUserMedia(constraint);
  document.getElementById("user-1").srcObject = localStream;
  client = await AgoraRTM.createInstance(APP_ID);
  await client.login({ uid, token });

  channel = client.createChannel(roomId);
  await channel.join();

  channel.on("MemberJoined", handleUserJoined);
  channel.on("MemberLeft", handleUserLeft);

  client.on("MessageFromPeer", handleMessageFromPeer);
};

let handleUserLeft = (MemberId) => {
  document.getElementById("user-2").style.display = "none";
  document.getElementById("user-1").classList.remove("smallFrame");
};

let handleMessageFromPeer = async (Message, MemberId) => {
  Message = JSON.parse(Message.text);
  console.log("Message", Message);
  if (Message.type === "offer") {
    createAnswer(MemberId, Message.offer);
  } else if (Message.type === "answer") {
    addAnswer(Message.answer);
  } else if (Message.type === "candidate");
  {
    if (peerConnection) {
      peerConnection.addIceCandidate(Message.candidate);
    }
  }
};

// // Handle when a user joins the channel
const handleUserJoined = async (MemberId) => {
  console.log("A new user joined the channel:", MemberId);
  createOffer(MemberId);
};

const createPeerConnection = async (MemberId) => {
  remoteStream = new MediaStream();
  peerConnection = new RTCPeerConnection(servers);

  document.getElementById("user-2").srcObject = remoteStream;
  document.getElementById("user-2").style.display = "block";

  document.getElementById("user-1").classList.add("smallFrame");

  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia(constraint);
    document.getElementById("user-1").srcObject = localStream;
  }
  // Add local stream tracks to the peer connection
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      client.sendMessageToPeer(
        {
          text: JSON.stringify({
            type: "candidate",
            candidate: event.candidate,
          }),
        },
        MemberId
      );
    }
  };
};

let createOffer = async (MemberId) => {
  await createPeerConnection(MemberId);

  //   // Create an offer and set it as the local description
  let offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  //   // Send the offer via the Agora RTM channel
  client.sendMessageToPeer(
    {
      text: JSON.stringify({ type: "offer", offer }),
    },
    MemberId
  );
  console.log("Created offer:", offer);
};

const createAnswer = async (MemberId, offer) => {
  await createPeerConnection(MemberId);

  await peerConnection.setRemoteDescription(offer);

  let answer = await peerConnection.createAnswer();

  await peerConnection.setLocalDescription(answer);

  client.sendMessageToPeer(
    {
      text: JSON.stringify({ type: "answer", answer }),
    },
    MemberId
  );
};

const addAnswer = async (answer) => {
  if (!peerConnection.currentRemoteDescription) {
    peerConnection.setRemoteDescription(answer);
  }
};

let leaveChannel = async () => {
  await channel.leave();
  await client.logout();
};

let toggleCamera = async () => {
  let videoTrack = localStream
    .getTracks()
    .find((track) => track.kind === "video");

  if (videoTrack.enabled) {
    videoTrack.enabled = false;
    document.getElementById("camera-btn").style.backgroundColor =
      "rgb(255 , 80 ,80)";
  } else {
    videoTrack.enabled = true;
    document.getElementById("camera-btn").style.backgroundColor =
      "rgb(179 , 102 ,249 ,.9)";
  }
};

let toggleMic = async () => {
  let audioTrack = localStream
    .getTracks()
    .find((track) => track.kind === "audio");

  if (audioTrack.enabled) {
    audioTrack.enabled = false;
    document.getElementById("mic-btn").style.backgroundColor =
      "rgb(255 , 80 ,80)";
  } else {
    audioTrack.enabled = true;
    document.getElementById("mic-btn").style.backgroundColor =
      "rgb(179 , 102 ,249 ,.9)";
  }
};

window.addEventListener("beforeunload", leaveChannel);

document.getElementById("camera-btn").addEventListener("click", toggleCamera);
document.getElementById("mic-btn").addEventListener("click", toggleMic);

init();
