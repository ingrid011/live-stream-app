let options = {
  origin: "https://api.inlive.app",
  apiVersion: "v1",
  // hardcode API Key
  apiKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjMzMjA2ODM5ODAzLCJqdGkiOiJiN2Y4YzVmMS0xMmUyLTQ4ZTItYWNlMS0xYzM5YWY3ZTY1M2EiLCJpYXQiOjE2NDkyMzk4MDMsImlzcyI6ImlubGl2ZSIsImRiaWQiOjMsIlRva2VuVHlwZSI6ImFwaWtleSIsIlVzZXIiOnsiaWQiOjEyLCJ1c2VybmFtZSI6IiIsInBhc3N3b3JkIjoiIiwiY29uZmlybV9wYXNzd29yZCI6IiIsIm5hbWUiOiIiLCJsb2dpbl90eXBlIjowLCJlbWFpbCI6IiIsInJvbGVfaWQiOjAsInBpY3R1cmVfdXJsIjoiIiwiaXNfYWN0aXZlIjpmYWxzZSwicmVnaXN0ZXJfZGF0ZSI6IjAwMDEtMDEtMDFUMDA6MDA6MDBaIiwidXBkYXRlZF9kYXRlIjpudWxsfX0.rebFyPbrtDGtyyNCYR11IBAubaNjkooL5NkGmLZrPvI",
};
let createdStreamData = {};
let getStreamVideoData = {};

// api request func
async function apiRequest(apiKey, url, method, body) {
  const opts = {
    method: method,
    mode: "cors",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  };

  if (typeof body !== "undefined") {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);

  try {
    const bodyJSON = await res.json();
    return bodyJSON;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

function replaceWhiteSpace(s) {
  if (/\s/.test(s)) {
    return s.split(" ").join("-");
  } else {
    return s;
  }
}

// create stream
async function createStream() {
  const url = `${options.origin}/${options.apiVersion}/streams/create`;
  try {
    const streamName = document.getElementById("inputStreamName").value;
    let checkName;

    // random the stream name if not type in the input field
    if (streamName != "") {
      checkName = streamName;
    } else {
      checkName = Math.random().toString(36).slice(5);
    }

    // request api
    const resp = await apiRequest(options.apiKey, url, "POST", {
      name: streamName != "" ? streamName : checkName,
      slug: streamName != "" ? replaceWhiteSpace(streamName) : checkName,
    });
    createdStreamData = resp;

    // styling - box view
    document.getElementById("createContainer").style.display = "none";
    document.getElementById("mainContainer").style.display = "flex";
    document.getElementById(
      "yourStream"
    ).innerHTML = `Stream name : <b>${createdStreamData?.data?.name}</b>`;
  } catch (err) {
    console.error(err);
  }
}

// preparing stream
async function prepareStream(slug) {
  const url = `${options.origin}/${options.apiVersion}/streams/${slug}/prepare`;

  try {
    const resp = await apiRequest(options.apiKey, url, "POST");

    //styling
    document.getElementById("startStream").style.display = "none";
    document.getElementById("streamStatus").innerHTML =
      "<b>Preparing stream ...</b>";

    if (resp.code !== 200) {
      throw new Error("Failed to prepare stream session");
    }
  } catch (err) {
    console.error(err);
  }
}

// init stream
async function initStream(slug, peerConnection, options) {
  const streamName = createdStreamData?.name;

  const body = {
    slug: streamName,
    session_description: peerConnection?.localDescription,
  };

  try {
    const url = `${options.origin}/${options.apiVersion}/streams/${slug}/init`;

    const resp = await apiRequest(options.apiKey, url, "POST", body);

    if (resp.code === 200) {
      const answerSDP = new RTCSessionDescription(resp.data);
      peerConnection.setRemoteDescription(answerSDP);

      //styling
      document.getElementById("streamStatus").innerHTML =
        "<b>Streaming is ready!</b>";
    } else {
      throw new Error("Failed to init stream session");
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// start stream inside start stream function
async function startStreaming(slug) {
  try {
    const url = `${options.origin}/${options.apiVersion}/streams/${slug}/start`;
    const resp = await apiRequest(options.apiKey, url, "POST");

    if (resp.code === 200) {
      console.log("streaming started");

      // styling
      document.getElementById("streamStatus").innerHTML =
        "<b>Streaming started!</b>";
      document.getElementById("getStream").style.display = "flex";
      document.getElementById("startStream").style.display = "none";
      document.getElementById("endStream").style.display = "block";

      return resp;
    } else {
      throw new Error("Failed to start stream session");
    }
  } catch (error) {
    console.error(error);
  }
}

// start stream button
async function startStream() {
  try {
    document.getElementById("streamStatus").innerHTML = "<b>Please wait</b>";
    await prepareStream(createdStreamData?.data?.id);

    const videoEl = document.querySelector("video");

    const constraints = {
      video: {
        frameRate: 30,
        width: 1200,
        height: 720,
      },
      audio: true,
    };

    const localStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = localStream;

    const servers = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:34.101.121.241:3478",
          username: "username",
          credential: "password",
        },
      ],
    };

    const peerConnection = new RTCPeerConnection(servers);
    console.log("peerConnection", peerConnection);

    peerConnection.oniceconnectionstatechange = () => {
      const iceConnectionState = peerConnection.iceConnectionState;
      console.log("iceConnectionState", iceConnectionState);
    };

    peerConnection.onicecandidate = async (event) => {
      if (event.candidate === null) {
        await initStream(createdStreamData?.data?.id, peerConnection, options);
        await startStreaming(createdStreamData?.data?.id);
      }
    };

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    const offerSession = await peerConnection.createOffer();
    peerConnection.setLocalDescription(offerSession);
  } catch (err) {
    console.error(err);
  }
}

// get stream
async function getStream(slug, options) {
  try {
    const url = `${options.origin}/${options.apiVersion}/streams/${slug}`;
    const apiResp = await apiRequest(options.apiKey, url, "GET");
    getStreamVideoData = apiResp;

    // copy the get stream link to clipboard when click the button
    let element = document.getElementById("getStreamLink");
    element.value = getStreamVideoData?.data?.dash_manifest_path;
    element.select();
    element.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(element.value);
    document.getElementById("streamLink").innerHTML =
      "<p>Link copied to clipboard!</p>";

    return apiResp;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// end stream
async function endStream(slug) {
  try {
    const url = `${options.origin}/${options.apiVersion}/streams/${slug}/end`;
    const apiResp = await apiRequest(options.apiKey, url, "POST");

    // if success, then will show an alert stream has ended and will reload to the initial view
    alert("Streaming ended!");
    window.location.reload();

    return apiResp;
  } catch (err) {
    console.error(err);
    throw err;
  }
}
