import type { AddLogMessage } from "../../types/MessageTypes";
import type { SongGuessServer } from "../index";
import * as util from "node:util";


export default class Logger {
  /**
   * Log messages are prefixed with this string.
   */
  get LOG_PREFIX(): string {
    return `[Room ${this.server.name}]`;
  }

  /**
   * Creates a new Logger instance.
   */
  constructor(readonly server: SongGuessServer) {}

  /**
   * Logs an informational message to storage and console.
   */
  public info(message: any): void {
    this.storeAndLogMessage(message, "info");
  }

  /**
   * Logs a warning message to storage and console.
   */
  public warn(message: any): void {
    this.storeAndLogMessage(message, "warn");
  }

  /**
   * Logs an error message to storage and console.
   */
  public error(message: any): void {
    this.storeAndLogMessage(message, "error");
  }

  /**
   * Logs a debug message to storage and console.
   */
  public debug(message: any): void {
    this.storeAndLogMessage(message, "debug");
  }

  /**
   * Formats an object into a string representation for logging.
   */
  private formatLogEntry(obj: any): string {
    return typeof obj === "string"
      ? obj
      : util.inspect(obj, { showHidden: false, depth: null, colors: false });
  }

  /**
   * Truncates a message if it exceeds the maximum length.
   * @param message The message to truncate.
   * @param maxLength Maximum allowed length (default 1500).
   */
  private truncateMessage(message: string, maxLength: number = 1500): string {
    if (message.length <= maxLength) {
      return message;
    }
    const header = "\n[...]\n";
    const halfLength = Math.floor(maxLength / 2);
    return message.slice(0, halfLength) + header + message.slice(-halfLength);
  }

  /**
   * Sends the log message to all connected admins and logs it to console which the worker runtime will store.
   * @param message The message to log. Debug messages will not be logged to console (and therefore not be stored).
   * @param level The log level (info, warn, error, debug).
   */
  private storeAndLogMessage(message: string, level: AddLogMessage["level"]): void {
    message = this.formatLogEntry(message);

    if (level !== "info")
      message = this.truncateMessage(message);

    if (level !== "debug") {
      console[level](`${this.LOG_PREFIX} ${message}`);
    }

    this.server.safeBroadcast({
      type: "add_log_message",
      level,
      entry: {
        msg: message,
        timestamp: Date.now(),
      },
    }, "admin");
  }
}
