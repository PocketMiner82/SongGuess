import z from "zod";
import {
  ChangeUsernameMessageSchema, AddPlaylistMessageSchema, RemovePlaylistMessageSchema, StartGameMessageSchema,
  SelectAnswerMessageSchema, ReturnToLobbyMessageSchema
} from "./RoomClientMessageSchemas";
import { UpdateMessageSchema, UpdatePlaylistsMessageSchema, CountdownMessageSchema, AudioControlMessageSchema, AnswerMessageSchema, QuestionMessageSchema } from "./RoomServerMessageSchemas";


const _ClientMessageSchema = z.discriminatedUnion("type", [
  ChangeUsernameMessageSchema,
  AddPlaylistMessageSchema,
  RemovePlaylistMessageSchema,
  StartGameMessageSchema,
  SelectAnswerMessageSchema,
  ReturnToLobbyMessageSchema
]);

const _ServerMessageSchema = z.discriminatedUnion("type", [
  UpdateMessageSchema,
  UpdatePlaylistsMessageSchema,
  CountdownMessageSchema,
  AudioControlMessageSchema,
  QuestionMessageSchema,
  AnswerMessageSchema
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
export const SourceMessageSchema = z.discriminatedUnion("type", [
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

/**
 * A message sent from the server.
 */
export const ServerMessageSchema = z.discriminatedUnion("type", [
  ConfirmationMessageSchema,
  _ServerMessageSchema
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;


/**
 * A message sent from a client.
 */
export const ClientMessageSchema = z.discriminatedUnion("type", [
  ConfirmationMessageSchema,
  _ClientMessageSchema
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;