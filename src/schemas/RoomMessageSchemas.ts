import z from "zod";
import { ChangeUsernameMessageSchema, HostUpdatePlaylistMessageSchema, StartGameMessageSchema } from "./RoomClientMessageSchemas";
import { UpdateMessageSchema, ServerUpdatePlaylistMessageSchema, CountdownMessageSchema, AudioControlMessageSchema } from "./RoomServerMessageSchemas";


const _ClientMessageSchema = z.discriminatedUnion("type", [
  ChangeUsernameMessageSchema,
  HostUpdatePlaylistMessageSchema,
  StartGameMessageSchema
]);

const _ServerMessageSchema = z.discriminatedUnion("type", [
  UpdateMessageSchema,
  ServerUpdatePlaylistMessageSchema,
  CountdownMessageSchema
]);

export const ConfirmationMessageSchema = z.object({
  type: z.literal("confirmation"),

  /**
   * The message type that is being confirmed.
   */
  source: z.literal([
    ..._ClientMessageSchema.options.map(o => o.shape.type.value),
    ..._ServerMessageSchema.options.map(o => o.shape.type.value),
    // special case: AudioControlMessage is a discriminated union itself
    ...AudioControlMessageSchema.options.map(o => o.shape.type.value),
    "other"
  ]),

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
  _ServerMessageSchema,
  AudioControlMessageSchema
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