import z from "zod";
import { ChangeUsernameMessageSchema, HostUpdatePlaylistMessageSchema, StartGameMessageSchema } from "./RoomClientMessageSchemas";
import { UpdateMessageSchema, CountdownMessageSchema, ServerUpdatePlaylistMessageSchema } from "./RoomServerMessageSchemas";
import { GeneralErrorMessageSchema } from "./RoomSharedMessageSchemas";


/**
 * A message sent from a client.
 */
export const ClientMessageSchema = z.union([
  GeneralErrorMessageSchema,
  ChangeUsernameMessageSchema,
  HostUpdatePlaylistMessageSchema,
  StartGameMessageSchema
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;


/**
 * A message sent from the server.
 */
export const ServerMessageSchema = z.union([
  GeneralErrorMessageSchema,
  UpdateMessageSchema,
  ServerUpdatePlaylistMessageSchema,
  CountdownMessageSchema
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;