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


  constructor(readonly server: Server) {}


  /**
   * Logs an informational message to storage and console.
   */
  public info(message: any): void {
    let text = this.formatLogEntry(message);

    console.log(`${this.LOG_PREFIX} ${text}`);
    this.storeLogMessage(text, "info");
  }

  /**
   * Logs a warning message to storage and console.
   */
  public warn(message: any): void {
    let text = this.formatLogEntry(message);

    console.warn(`${this.LOG_PREFIX} ${text}`);
    this.storeLogMessage(text, "warn");
  }

  /**
   * Logs an error message to storage and console.
   */
  public error(message: any): void {
    let text = this.formatLogEntry(message);

    console.error(`${this.LOG_PREFIX} ${text}`);
    this.storeLogMessage(text, "error");
  }

  /**
   * Logs a debug message to storage and console.
   */
  public debug(message: any): void {
    let text = this.formatLogEntry(message);

    console.debug(`${this.LOG_PREFIX} ${text}`);
    this.storeLogMessage(text, "debug");
  }

  private formatLogEntry(obj: any): string {
    return typeof obj === "string" ? obj :
        util.inspect(obj, { showHidden: false, depth: null, colors: false });
  }

  private storeLogMessage(message: string, level: AddLogMessage["level"]): void {
    for (let conn of this.server.getActiveConnections("admin")) {
      this.server.safeSend(conn, {
        type: "add_log_message",
        level: level,
        entry: {
          msg: message,
          timestamp: Date.now()
        },
      });
    }

    this.writeQueue = this.writeQueue.then(async () => {
      let loggerStorage = await this.getLogMessages();
      loggerStorage[level].push({
        msg: message,
        timestamp: Date.now()
      });

      // limit log size to 50 messages (100 for debug)
      while (loggerStorage[level].length > (level === "debug" ? 100 : 50)) {
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