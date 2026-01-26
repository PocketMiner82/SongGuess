import {createRoot} from "react-dom/client";
import usePartySocket from "partysocket/react";
import z, {uuidv4} from "zod";
import {useCookies} from "react-cookie";
import type ICookieProps from "../types/ICookieProps";
import {ServerMessageSchema} from "../schemas/MessageSchemas";
import type {ServerMessage} from "../types/MessageTypes";


/**
 * The PartyKit host URL for WebSocket connections.
 */
declare const PARTYKIT_HOST: string;


function App() {
  const roomID = new URLSearchParams(window.location.search).get("id") ?? "null";

  const [cookies, setCookie] = useCookies<"userID"|"userName", ICookieProps>(["userID", "userName"]);

  // generate uuid if not set via cookie
  let id = `admin_${cookies.userID ? cookies.userID : uuidv4()}`;

  const socket = usePartySocket({
    host: PARTYKIT_HOST,
    room: roomID,
    maxRetries: 0,
    id: id,
    onMessage: (ev) => {
      // try to parse JSON
      try {
        // noinspection ES6ConvertVarToLetConst
        var json = JSON.parse(ev.data);
      } catch (e) {
        console.debug("Server sent:", ev.data);
        console.error("Server sent invalid JSON:", e);
        return;
      }

      // check if received message is valid
      const result = ServerMessageSchema.safeParse(json);
      if (!result.success) {
        console.debug("Server sent:", ev.data);
        console.error("Server sent invalid data:\n%s", z.prettifyError(result.error));
        return;
      }

      let msg: ServerMessage = result.data;
    }
  });

  if (!cookies.userID) {
    setCookie("userID", id);
  }

  return ();
}

createRoot(document.getElementById("app")!).render(<App />);