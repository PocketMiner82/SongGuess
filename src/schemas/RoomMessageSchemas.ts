import z from "zod";
import {
  ChangeUsernameMessageSchema, AddPlaylistMessageSchema, RemovePlaylistMessageSchema, StartGameMessageSchema,
  SelectAnswerMessageSchema, ReturnToMessageSchema
} from "./RoomClientMessageSchemas";
import {
  UpdateMessageSchema,
  UpdatePlaylistsMessageSchema,
  CountdownMessageSchema,
  AudioControlMessageSchema,
  AnswerMessageSchema,
  QuestionMessageSchema,
  UpdatePlayedSongsMessageSchema
} from "./RoomServerMessageSchemas";


export const RoomConfigMessageSchema = z.object({
  type: z.literal("room_config").default("room_config"),

  /**
   * Whether to perform advanced filtering tactics when generating the songs array.
   * Currently just ignores parens when filtering for identical song names.
   */
  advancedSongFiltering: z.optional(z.boolean())
});

export type RoomConfigMessage = z.infer<typeof RoomConfigMessageSchema>;


const _ClientMessageSchema = z.discriminatedUnion("type", [
  ChangeUsernameMessageSchema,
  AddPlaylistMessageSchema,
  RemovePlaylistMessageSchema,
  RoomConfigMessageSchema,
  StartGameMessageSchema,
  SelectAnswerMessageSchema,
  ReturnToMessageSchema
]);

const _ServerMessageSchema = z.discriminatedUnion("type", [
  UpdateMessageSchema,
  UpdatePlaylistsMessageSchema,
  RoomConfigMessageSchema,
  CountdownMessageSchema,
  AudioControlMessageSchema,
  QuestionMessageSchema,
  AnswerMessageSchema,
  UpdatePlayedSongsMessageSchema
]);


/**
 * Schema for a fallback message type used when the message type is not recognized.
 */
export const OtherMessageSchema = z.object({
  type: z.literal("other").default("other")
})


/**
 * Schema for messages that can be either server messages, client messages, or other messages.
 * Used as a discriminated union to handle different message types.
 */
export const SourceMessageSchema = z.union([
  _ServerMessageSchema,
  _ClientMessageSchema,
  OtherMessageSchema
]);

export type SourceMessage = z.infer<typeof SourceMessageSchema>;


/**
 * Schema for confirmation messages sent in response to client actions.
 */
export const ConfirmationMessageSchema = z.object({
  type: z.literal("confirmation").default("confirmation"),

  /**
   * The message that is being confirmed.
   */
  sourceMessage: SourceMessageSchema,

  /**
   * Optional error message if the requested action could not be performed.
   */
  error: z.optional(z.string())
});

export type ConfirmationMessage = z.infer<typeof ConfirmationMessageSchema>;

export const PingMessageSchema = z.object({
  type: z.literal("ping").default("ping"),

  /**
   * The sequence number the pong should respond with
   */
  seq: z.number()
});

export type PingMessage = z.infer<typeof PingMessageSchema>;


export const PongMessageSchema = z.object({
  type: z.literal("pong").default("pong"),

  /**
   * The sequence number asked for in the ping packet.
   */
  seq: z.number()
});

export type PongMessage = z.infer<typeof PongMessageSchema>;


/**
 * A message sent from the server.
 */
export const ServerMessageSchema = z.discriminatedUnion("type", [
  ConfirmationMessageSchema,
  PingMessageSchema,
  PongMessageSchema,
  _ServerMessageSchema
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;


/**
 * A message sent from a client.
 */
export const ClientMessageSchema = z.discriminatedUnion("type", [
  ConfirmationMessageSchema,
  PingMessageSchema,
  PongMessageSchema,
  _ClientMessageSchema
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;