import z from "zod";
import type {LogEntry, LoggerStorage} from "../types/LoggerStorageTypes";

export const AddLogMessageSchema = z.object({
  type: z.literal("add_log_message").default("add_log_message"),

  /**
   * The log level of the added message.
   */
  level: z.literal(["info", "warn", "error", "debug"]),

  /**
   * The added log message.
   */
  entry: z.custom<LogEntry>()
});

export const UpdateLogMessagesSchema = z.object({
  type: z.literal("update_log_messages").default("update_log_messages"),

  messages: z.custom<LoggerStorage>()
})