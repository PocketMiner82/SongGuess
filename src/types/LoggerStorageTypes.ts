/**
 * A single log entry containing a message and timestamp.
 */
export interface LogEntry {
  /** The log message text */
  msg: string;
  /** Unix timestamp when the log entry was created */
  timestamp: number;
}

/**
 * Storage container for log messages organized by log level.
 */
export interface LoggerStorage {
  /** Array of informational log entries */
  info: LogEntry[];
  /** Array of warning log entries */
  warn: LogEntry[];
  /** Array of error log entries */
  error: LogEntry[];
  /** Array of debug log entries */
  debug: LogEntry[];
}

/**
 * Default empty logger storage with no entries.
 */
export const DefaultLoggerStorage = {
  info: [],
  warn: [],
  error: [],
  debug: [],
};
