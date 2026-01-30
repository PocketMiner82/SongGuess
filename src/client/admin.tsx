import {createRoot} from "react-dom/client";
import usePartySocket from "partysocket/react";
import z, {uuidv4} from "zod";
import {CookiesProvider, useCookies} from "react-cookie";
import type ICookieProps from "../types/ICookieProps";
import {ServerMessageSchema} from "../schemas/MessageSchemas";
import type {ServerMessage} from "../types/MessageTypes";
import type {LogEntry, LoggerStorage} from "../types/LoggerStorageTypes";
import React, {useEffect, useMemo, useState, useRef, useCallback} from "react";
import {TopBar} from "./components/TopBar";
import {Button} from "./components/Button";


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
    <div className="flex flex-col h-screen">
      <TopBar />
      <div className="flex items-center justify-center flex-1 p-4">
        <div className="w-full max-w-md">
          <div className="bg-card-bg rounded-lg border border-gray-300 dark:border-gray-700 p-6">
            <h2 className="text-2xl font-bold text-default mb-6 text-center">Admin Login</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                autoFocus
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-default-bg text-default focus:outline-none focus:ring-2 focus:ring-secondary"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-default-bg text-default focus:outline-none focus:ring-2 focus:ring-secondary"
              />
              <Button onClick={() => document.querySelector('form')?.requestSubmit()} className="w-full">
                Connect
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogViewer({logs, filters, onFilterChange}: {
  logs: LoggerStorage;
  filters: LogFilters;
  onFilterChange: (filters: LogFilters) => void;
}) {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolled, setIsUserScrolled] = useState(false);

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getLogColor = (level: keyof LogFilters): string => {
    switch (level) {
      case "error": return "text-error";
      case "warn": return "text-yellow-600 dark:text-yellow-400";
      case "info": return "text-success";
      case "debug": return "text-secondary";
      default: return "text-default";
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

  const scrollToBottom = useCallback(() => {
    if (logContainerRef.current && !isUserScrolled) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [isUserScrolled]);

  const handleScroll = useCallback(() => {
    if (logContainerRef.current) {
      const {scrollTop, scrollHeight, clientHeight} = logContainerRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setIsUserScrolled(!isAtBottom);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [filteredLogs.length, scrollToBottom]);

  return (
    <div className="flex flex-col h-screen font-mono">
      <TopBar />
      <div className="bg-card-bg border-b border-gray-300 dark:border-gray-700 p-4">
        <h2 className="text-xl font-bold mb-3">Server Logs</h2>
        <div className="flex flex-wrap gap-4">
          {Object.entries(filters).map(([level, enabled]) => (
            <label key={level} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => handleFilterToggle(level as keyof LogFilters)}
                className="w-4 h-4 bg-gray-100 border-gray-300 rounded dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span className={`${getLogColor(level as keyof LogFilters)} uppercase text-sm font-medium`}>
                {level}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div 
        ref={logContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto p-4"
      >
        {filteredLogs.map(({level, entry}, index) => (
          <div key={index} className={`mb-0.5 ${getLogColor(level)}`}>
            <span className="text-gray-500">
              [{formatTimestamp(entry.timestamp)}]
            </span>
            <span className="font-bold ml-2 mr-2">
              [{level.toUpperCase()}]
            </span>
            <span className="text-sm text-default whitespace-pre-wrap">{entry.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthenticatedApp({auth}: { auth: AuthData }) {
  const [logs, setLogs] = useState<LoggerStorage>({info: [], warn: [], error: [], debug: []});
  const [filters, setFilters] = useState<LogFilters>({info: true, warn: true, error: true, debug: false});
  const [connectionStatus, setConnectionStatus] = useState<string|null>("Connecting...");

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
      setConnectionStatus(null);
    },
    onClose: e => {
      if (e.code === 4403) {
        setConnectionStatus(e.reason);
      } else {
        setConnectionStatus("Reconnecting...");
      }
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
              [msg.level]: [...prev[msg.level as keyof LoggerStorage], msg.entry]
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
        {connectionStatus && (
            <div className="fixed bottom-0 left-0 right-0 bg-error text-white text-center py-2 z-5000">
              {connectionStatus}
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