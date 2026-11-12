import { setShowOverlay, setMessages } from "../store/actions";
import store from "../store/store";
import * as wss from "./wss";
import Peer from "simple-peer";
import { fetchTURNCredentials, getTurnIceServers } from "./turn";

const defaultConstraints = {
  audio: true,
  video: {
    width: "480",
    height: "360",
  },
};

const onlyAudioConstraints = {
  audio: true,
  video: false,
};

let localStream;

export const getLocalPreviewAndInitRoomConnection = async (
  isRoomHost,
  identity,
  roomId = null,
  onlyAudio
) => {
  await fetchTURNCredentials();

  const constraints = onlyAudio ? onlyAudioConstraints : defaultConstraints;

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      console.log("successfuly received local stream");
      localStream = stream;
      showLocalVideoPreview(localStream);

      // dispatch an action to hide overlay
      store.dispatch(setShowOverlay(false));

      isRoomHost
        ? wss.createNewRoom(identity, onlyAudio)
        : wss.joinRoom(identity, roomId, onlyAudio);
    })
    .catch((err) => {
      console.log(
        "error occurred when trying to get an access to local stream"
      );
      console.log(err);
    });
};

let peers = {};
let streams = [];

const getConfiguration = () => {
  const turnIceServers = getTurnIceServers();

  if (turnIceServers) {
    return {
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
        ...turnIceServers,
      ],
    };
  } else {
    console.warn("Using only STUN server");
    return {
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    };
  }
};

const messengerChannel = "messenger";

export const prepareNewPeerConnection = (connUserSocketId, isInitiator) => {
  const configuration = getConfiguration();

  peers[connUserSocketId] = new Peer({
    initiator: isInitiator,
    config: configuration,
    stream: localStream,
    channelName: messengerChannel,
  });

  peers[connUserSocketId].on("signal", (data) => {
    // webRTC offer, webRTC Answer (SDP informations), ice candidates

    const signalData = {
      signal: data,
      connUserSocketId: connUserSocketId,
    };

    wss.signalPeerData(signalData);
  });

  peers[connUserSocketId].on("stream", (stream) => {
    console.log("new stream came");

    addStream(stream, connUserSocketId);
    streams = [...streams, stream];
  });

  peers[connUserSocketId].on("data", (data) => {
    const messageData = JSON.parse(data);
    appendNewMessage(messageData);
  });
};

export const handleSignalingData = (data) => {
  //add signaling data to peer connection
  peers[data.connUserSocketId].signal(data.signal);
};

export const removePeerConnection = (data) => {
  const { socketId } = data;
  const videoContainer = document.getElementById(socketId);
  const videoEl = document.getElementById(`${socketId}-video`);

  if (videoContainer && videoEl) {
    const tracks = videoEl.srcObject.getTracks();

    tracks.forEach((t) => t.stop());

    videoEl.srcObject = null;
    videoContainer.removeChild(videoEl);

    videoContainer.parentNode.removeChild(videoContainer);

    if (peers[socketId]) {
      peers[socketId].destroy();
    }
    delete peers[socketId];
  }
};

////////////////////////////////// UI Videos //////////////////////////////////
const showLocalVideoPreview = (stream) => {
  const videosContainer = document.getElementById("videos_portal");
  videosContainer.classList.add("videos_portal_styles");
  const videoContainer = document.createElement("div");
  videoContainer.classList.add("video_track_container");
  const videoElement = document.createElement("video");
  videoElement.autoplay = true;
  videoElement.muted = true;
  videoElement.srcObject = stream;

  videoElement.onloadedmetadata = () => {
    videoElement.play();
  };

  videoContainer.appendChild(videoElement);

  if (store.getState().connectOnlyWithAudio) {
    videoContainer.appendChild(getAudioOnlyLabel());
  }

  videosContainer.appendChild(videoContainer);
};

const addStream = (stream, connUserSocketId) => {
  //display incoming stream
  const videosContainer = document.getElementById("videos_portal");
  const videoContainer = document.createElement("div");
  videoContainer.id = connUserSocketId;

  videoContainer.classList.add("video_track_container");
  const videoElement = document.createElement("video");
  videoElement.autoplay = true;
  videoElement.srcObject = stream;
  videoElement.id = `${connUserSocketId}-video`;

  videoElement.onloadedmetadata = () => {
    videoElement.play();
  };

  videoElement.addEventListener("click", () => {
    if (videoElement.classList.contains("full_screen")) {
      videoElement.classList.remove("full_screen");
    } else {
      videoElement.classList.add("full_screen");
    }
  });

  videoContainer.appendChild(videoElement);

  // check if other user connected only with audio
  const participants = store.getState().participants;

  const participant = participants.find((p) => p.socketId === connUserSocketId);
  console.log(participant);
  if (participant?.onlyAudio) {
    videoContainer.appendChild(getAudioOnlyLabel(participant.identity));
  } else {
    videoContainer.style.position = "relative";
  }

  videosContainer.appendChild(videoContainer);
};

const getAudioOnlyLabel = (identity = "") => {
  const labelContainer = document.createElement("div");
  labelContainer.classList.add("label_only_audio_container");

  const label = document.createElement("p");
  label.classList.add("label_only_audio_text");
  label.innerHTML = `Only audio ${identity}`;

  labelContainer.appendChild(label);
  return labelContainer;
};

////////////////////////////////// Buttons logic //////////////////////////////////

const getLiveTrack = (kind) => {
  if (!localStream) {
    return null;
  }
  const tracks =
    kind === "audio" ? localStream.getAudioTracks() : localStream.getVideoTracks();
  return tracks.find((track) => track.readyState === "live") || null;
};

const getLocalPreviewVideoElement = () => {
  const portal = document.getElementById("videos_portal");
  if (!portal) {
    return null;
  }
  for (const container of portal.querySelectorAll(".video_track_container")) {
    if (!container.id) {
      return container.querySelector("video");
    }
  }
  return null;
};

const refreshLocalPreviewElement = () => {
  const videoElement = getLocalPreviewVideoElement();
  if (videoElement && localStream) {
    videoElement.srcObject = localStream;
  }
};

const replaceTrackForAllPeers = (oldTrack, newTrack) => {
  if (!oldTrack || !newTrack || !localStream) {
    return;
  }
  for (const socketId in peers) {
    const peer = peers[socketId];
    if (!peer) {
      continue;
    }
    try {
      peer.replaceTrack(oldTrack, newTrack, localStream);
    } catch (err) {
      console.log("error updating peer media track", err);
    }
  }
};

const stopLocalTrack = (kind) => {
  if (!localStream) {
    return;
  }
  const tracks =
    kind === "audio" ? localStream.getAudioTracks() : localStream.getVideoTracks();
  tracks.forEach((track) => {
    try {
      // End the MediaStreamTrack so the browser releases the device (LED/mic).
      track.stop();
    } catch (err) {
      console.log("error stopping local track", err);
    }
  });
  refreshLocalPreviewElement();
};

const restartLocalTrack = async (kind) => {
  if (!localStream) {
    return;
  }

  const constraints =
    kind === "audio"
      ? { audio: true, video: false }
      : { audio: false, video: defaultConstraints.video };

  const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
  const newTrack =
    kind === "audio"
      ? mediaStream.getAudioTracks()[0]
      : mediaStream.getVideoTracks()[0];

  const oldTracks =
    kind === "audio" ? localStream.getAudioTracks() : localStream.getVideoTracks();
  const oldTrack = oldTracks[0] || null;

  if (oldTrack) {
    replaceTrackForAllPeers(oldTrack, newTrack);
    localStream.removeTrack(oldTrack);
  } else {
    // No prior track to replace; attach to existing peer connections when possible.
    for (const socketId in peers) {
      const peer = peers[socketId];
      if (peer && typeof peer.addTrack === "function") {
        try {
          peer.addTrack(newTrack, localStream);
        } catch (err) {
          console.log("error adding restarted track to peer", err);
        }
      }
    }
  }

  localStream.addTrack(newTrack);
  refreshLocalPreviewElement();
};

// enabled=false keeps the device open; stop() releases mic/camera hardware.
export const toggleMic = async (isMuted) => {
  if (!localStream) {
    return;
  }

  if (isMuted) {
    try {
      await restartLocalTrack("audio");
    } catch (err) {
      console.log("error occurred when trying to turn the microphone back on");
      console.log(err);
    }
    return;
  }

  stopLocalTrack("audio");
};

export const toggleCamera = async (isDisabled) => {
  if (!localStream) {
    return;
  }

  if (isDisabled) {
    try {
      await restartLocalTrack("video");
    } catch (err) {
      console.log("error occurred when trying to turn the camera back on");
      console.log(err);
    }
    return;
  }

  stopLocalTrack("video");
};

export const toggleScreenShare = (
  isScreenSharingActive,
  screenSharingStream = null
) => {
  if (isScreenSharingActive) {
    switchVideoTracks(localStream);
  } else {
    switchVideoTracks(screenSharingStream);
  }
};

const switchVideoTracks = (stream) => {
  for (let socket_id in peers) {
    for (let index in peers[socket_id].streams[0].getTracks()) {
      for (let index2 in stream.getTracks()) {
        if (
          peers[socket_id].streams[0].getTracks()[index].kind ===
          stream.getTracks()[index2].kind
        ) {
          peers[socket_id].replaceTrack(
            peers[socket_id].streams[0].getTracks()[index],
            stream.getTracks()[index2],
            peers[socket_id].streams[0]
          );
          break;
        }
      }
    }
  }
};

////////////////////////////////// Messages /////////////////////////////////////
const appendNewMessage = (messageData) => {
  const messages = store.getState().messages;
  store.dispatch(setMessages([...messages, messageData]));
};

export const sendMessageUsingDataChannel = (messageContent) => {
  // append this message locally
  const identity = store.getState().identity;

  const localMessageData = {
    content: messageContent,
    identity,
    messageCreatedByMe: true,
  };

  appendNewMessage(localMessageData);

  const messageData = {
    content: messageContent,
    identity,
  };

  const stringifiedMessageData = JSON.stringify(messageData);
  for (let socketId in peers) {
    peers[socketId].send(stringifiedMessageData);
  }
};
