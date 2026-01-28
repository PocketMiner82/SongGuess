export type LogEntry = {
  msg: string,
  timestamp: number
};

export type LoggerStorage = {
  info: LogEntry[],
  warn: LogEntry[],
  error: LogEntry[],
  debug: LogEntry[]
};

export const DefaultLoggerStorage = {
  info: [],
  warn: [],
  error: [],
  debug: []
}