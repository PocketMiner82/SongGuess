import { lookup } from "itunes-store-api";
import "./index.css";

declare const PARTYKIT_HOST: string;

// Let's append all the messages we get into this DOM element
const output = document.getElementById("app") as HTMLDivElement;

// Helper function to add a new line to the DOM
function add(text: string) {
  output.appendChild(document.createTextNode(text));
  output.appendChild(document.createElement("br"));
}

function addAudio(trackName: string, url: string) {
  output.appendChild(document.createTextNode(`${trackName}: `));

  let audioElement = document.createElement("audio");
  audioElement.controls = true;
  let sourceElement = document.createElement("source");
  sourceElement.src = url;
  sourceElement.type = "audio/aac";
  audioElement.appendChild(sourceElement);
  audioElement.appendChild(document.createTextNode(url));

  output.appendChild(audioElement);

  output.appendChild(document.createElement("br"));
}

let storeInput: HTMLInputElement = document.getElementById("inputStoreUrl") as HTMLInputElement;
if (storeInput) {
  storeInput.onkeydown = async ev => {
    if (ev.key === "Enter") {
      try {
        var { results } = await lookup("url", storeInput.value, {
          entity: "song",
          sort: "popular",
          limit: 200
        });
      } catch {
        // @ts-ignore
        var { results } = await lookup("url", storeInput.value, {
          entity: "song",
          sort: "popular",
          limit: 200,
          magicnumber: Date.now()
        });
      }
      

      add(`Songs for "${storeInput.value}":`);

      results.forEach(result => {
        if (result.trackName && result.previewUrl) {
          addAudio(result.trackName, result.previewUrl);
        }
      });
    }
  };
}