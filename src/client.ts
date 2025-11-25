import "./styles.css";

import PartySocket from "partysocket";

declare const PARTYKIT_HOST: string;

let pingInterval: ReturnType<typeof setInterval>;

// Let's append all the messages we get into this DOM element
const output = document.getElementById("app") as HTMLDivElement;

// Helper function to add a new line to the DOM
function add(text: string) {
  output.appendChild(document.createTextNode(text));
  output.appendChild(document.createElement("br"));
}

// A PartySocket is like a WebSocket, except it's a bit more magical.
// It handles reconnection logic, buffering messages while it's offline, and more.
const conn = new PartySocket({
  host: PARTYKIT_HOST,
  room: "my-new-room",
});

// You can even start sending messages before the connection is open!
conn.addEventListener("message", (event) => {
  add(`Received -> ${event.data}`);
});

// Let's listen for when the connection opens
// And send a ping every 2 seconds right after
conn.addEventListener("open", () => {
  add("Connected!");
  add("Sending a ping every 2 seconds...");
  // TODO: make this more interesting / nice
  clearInterval(pingInterval);
  pingInterval = setInterval(() => {
    conn.send("ping");
  }, 1000);
});

(document.getElementById("spotifyLogin") as HTMLElement).onclick = connect;

const script = document.createElement('script');
script.src = 'https://sdk.scdn.co/spotify-player.js';
script.async = true;

document.body.appendChild(script);

function getCookie(name: string): string|null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  // @ts-ignore
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Store the device ID when the SDK is ready
let deviceId: string|undefined;

async function startMusic(trackUri: string) {
  const token = await getToken();
  
  if (!deviceId) {
    console.error("Device ID not ready yet");
    return;
  }

  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: "PUT",
    body: JSON.stringify({ uris: [trackUri] }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

async function getToken(redirect:boolean = true): Promise<string> {
  let token = getCookie("spotify-access-token");

  if (!token) {
    const response = await fetch("/auth/refreshToken");
    
    if (response.ok) {
      return getCookie("spotify-access-token") as string;
    } else if (response.status == 401 && redirect) {
      location.href = '/auth/login';
    } else if (redirect) {
      alert("Spotify authentication failed.");
    }

    return "";
  }

  return token;
}

let player: Spotify.Player;

function connect() {
  if (player) {
    player.connect().then(success => {
      if (success) {
        (document.getElementById("spotifyLogin") as HTMLElement).hidden = true;
      } else {
        alert("Spotify connection failed.");
      }
    });
  }
}

window.onSpotifyWebPlaybackSDKReady = () => {
  player = new window.Spotify.Player({
    name: "SongGuess",
    getOAuthToken: cb => { getToken().then(token => cb(token)) },
    volume: 0.15
  });

  player.addListener("ready", ({ device_id }) => {
    console.log("Ready with Device ID", device_id);
    deviceId = device_id;
    startMusic("spotify:track:4PTG3Z6ehGkBFwjybzWkR8");
  });

  if (getCookie("spotify-access-token")) {
    connect();
  } else {
    getToken(false).then(token => {
      if (token != "") {
        connect();
      } else {
        (document.getElementById("spotifyLogin") as HTMLElement).hidden = false;
      }
    });
  }
};
