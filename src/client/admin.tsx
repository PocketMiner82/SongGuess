import {createRoot} from "react-dom/client";
import usePartySocket from "partysocket/react";
import z, {uuidv4} from "zod";
import {CookiesProvider, useCookies} from "react-cookie";
import type ICookieProps from "../types/ICookieProps";
import {ServerMessageSchema} from "../schemas/MessageSchemas";
import type {ServerMessage} from "../types/MessageTypes";
import type {LogEntry, LoggerStorage} from "../types/LoggerStorageTypes";
import React, {useEffect, useMemo, useState} from "react";


/**
 * The PartyKit host URL for WebSocket connections.
 */
declare const PARTYKIT_HOST: string;


interface AuthData {
  username: string;
  password: string;
}

interface LogFilters {
  info: boolean;
  warn: boolean;
  error: boolean;
  debug: boolean;
}

function AuthForm({onAuth}: {onAuth: (auth: AuthData) => void}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && password) {
      onAuth({username, password});
    }
  };

  return (
    <div style={{display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "sans-serif"}}>
      <form onSubmit={handleSubmit} style={{display: "flex", flexDirection: "column", gap: "1rem", padding: "2rem", border: "1px solid #ccc", borderRadius: "8px"}}>
        <h2>Admin Login</h2>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px"}}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px"}}
        />
        <button type="submit" style={{padding: "0.5rem", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer"}}>
          Connect
        </button>
      </form>
    </div>
  );
}

function LogViewer({logs, filters, onFilterChange}: {
  logs: LoggerStorage;
  filters: LogFilters;
  onFilterChange: (filters: LogFilters) => void;
}) {
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getLogColor = (level: keyof LogFilters): string => {
    switch (level) {
      case "error": return "#ff6b6b";
      case "warn": return "#ffa726";
      case "info": return "#42a5f5";
      case "debug": return "#66bb6a";
      default: return "#ffffff";
    }
  };

  const filteredLogs = useMemo(() => {
    const allEntries: Array<{level: keyof LogFilters; entry: LogEntry}> = [];

    Object.entries(logs).forEach(([level, entries]) => {
      if (filters[level as keyof LogFilters]) {
        entries.forEach(entry => {
          allEntries.push({level: level as keyof LogFilters, entry});
        });
      }
    });

    return allEntries.sort((a, b) => a.entry.timestamp - b.entry.timestamp);
  }, [logs, filters]);

  const handleFilterToggle = (level: keyof LogFilters) => {
    onFilterChange({...filters, [level]: !filters[level]});
  };

  return (
    <div style={{display: "flex", flexDirection: "column", height: "100vh", fontFamily: "monospace"}}>
      <div style={{padding: "1rem", backgroundColor: "#2d3748", color: "white"}}>
        <h2 style={{margin: "0 0 1rem 0"}}>Server Logs</h2>
        <div style={{display: "flex", gap: "1rem"}}>
          {Object.entries(filters).map(([level, enabled]) => (
            <label key={level} style={{display: "flex", alignItems: "center", gap: "0.5rem"}}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => handleFilterToggle(level as keyof LogFilters)}
              />
              <span style={{color: getLogColor(level as keyof LogFilters), textTransform: "uppercase"}}>
                {level}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div style={{flex: 1, overflow: "auto", backgroundColor: "#1a202c", color: "#e2e8f0", padding: "1rem"}}>
        {filteredLogs.map(({level, entry}, index) => (
          <div key={index} style={{marginBottom: "0.5rem", color: getLogColor(level)}}>
            <span style={{color: "#a0aec0"}}>
              [{formatTimestamp(entry.timestamp)}]
            </span>
            <span style={{fontWeight: "bold", marginLeft: "0.5rem", marginRight: "0.5rem"}}>
              [{level.toUpperCase()}]
            </span>
            <span>{entry.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthenticatedApp({auth}: { auth: AuthData }) {
  const [logs, setLogs] = useState<LoggerStorage>({info: [], warn: [], error: [], debug: []});
  const [filters, setFilters] = useState<LogFilters>({info: true, warn: true, error: true, debug: false});
  const [connected, setConnected] = useState(false);

  const roomID = new URLSearchParams(window.location.search).get("id") ?? "null";
  const [cookies, setCookie] = useCookies<"userID"|"userName", ICookieProps>(["userID", "userName"]);

  const generateAuthQuery = (authData: AuthData): string => {
    return btoa(`${authData.username}:${authData.password}`);
  };

  let id = `admin_${cookies.userID ? cookies.userID : uuidv4()}`;

  usePartySocket({
    host: PARTYKIT_HOST,
    room: roomID,
    maxRetries: 50,
    id: id,
    onOpen: () => {
      setConnected(true);
    },
    onClose: () => {
      setConnected(false);
    },
    onMessage: (ev) => {
      try {
        const json = JSON.parse(ev.data);

        // Try parsing as regular server message
        const result = ServerMessageSchema.safeParse(json);
        if (!result.success) {
          console.debug("Server sent:", ev.data);
          console.error("Server sent invalid data:\n%s", z.prettifyError(result.error));
          return;
        }

        let msg: ServerMessage = result.data;

        switch (msg.type) {
          case "add_log_message":
            setLogs(prev => ({
              ...prev,
              [msg.level]: [...prev[msg.level as keyof LoggerStorage], {msg: msg.message, timestamp: Date.now()}]
            }));
            break;
          case "update_log_messages":
            setLogs(msg.messages);
            break;
        }
      } catch (e) {
        console.debug("Server sent:", ev.data);
        console.error("Server sent invalid JSON:", e);
      }
    },
    // Use query parameter for authentication
    query: {auth: generateAuthQuery(auth)}
  });

  useEffect(() => {
    if (!cookies.userID) {
      setCookie("userID", id);
    }
  }, [cookies.userID, id, setCookie]);

  return (
      <div>
        {!connected && (
            <div style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              backgroundColor: "#f44336",
              color: "white",
              textAlign: "center",
              padding: "0.5rem",
              zIndex: 1000
            }}>
              Connecting to server...
            </div>
        )}
        <LogViewer logs={logs} filters={filters} onFilterChange={setFilters} />
      </div>
  );
}

function App() {
  const [auth, setAuth] = useState<AuthData | null>(null);

  if (!auth) {
    return <AuthForm onAuth={data => setAuth(data)} />;
  }

  return <AuthenticatedApp auth={auth} />;
}

createRoot(document.getElementById("app")!).render(
    <CookiesProvider defaultSetOptions={{
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax"
    }}>
      <App />
    </CookiesProvider>
);