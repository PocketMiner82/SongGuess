import type Server from "../Server";
import {DefaultLoggerStorage, type LoggerStorage} from "../../types/LoggerStorageTypes";
import * as util from "node:util";
import type {AddLogMessage} from "../../types/MessageTypes";

export default class Logger {
  /**
   * Log messages are prefixed with this string.
   */
  readonly LOG_PREFIX: string = `[Room ${this.server.partyRoom.id}]`;

  // track last write operation
  private writeQueue: Promise<void> = Promise.resolve();


  /**
   * Creates a new Logger instance.
   */
  constructor(readonly server: Server) {}

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
    return typeof obj === "string" ? obj :
        util.inspect(obj, { showHidden: false, depth: null, colors: false });
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
   * Stores the message in storage and logs it to console.
   * @param message The message to log.
   * @param level The log level (info, warn, error, debug).
   */
  private storeAndLogMessage(message: string, level: AddLogMessage["level"]): void {
    message = this.formatLogEntry(message);
    console[level](`${this.LOG_PREFIX} ${message}`);

    if (level === "debug")
      message = this.truncateMessage(message);

    this.server.safeBroadcast({
      type: "add_log_message",
      level: level,
      entry: {
        msg: message,
        timestamp: Date.now()
      },
    }, "admin");

    this.writeQueue = this.writeQueue.then(async () => {
      let loggerStorage = await this.getLogMessages();
      loggerStorage[level].push({
        msg: message,
        timestamp: Date.now()
      });

      // limit log size to 50 messages (200 for debug)
      while (loggerStorage[level].length > (level === "debug" ? 200 : 50)) {
        loggerStorage[level].shift();
      }

      await this.server.partyRoom.storage.put("logger", loggerStorage);
    }).catch(err => {
      console.error("Failed to save log to storage:", err);
    });
  }

  /**
   * Fetches and returns all log messages.
   * @returns The messages inside a {@link LoggerStorage} object.
   */
  public async getLogMessages(): Promise<LoggerStorage> {
    return await this.server.partyRoom.storage.get<LoggerStorage>("logger") || DefaultLoggerStorage;
  }
}