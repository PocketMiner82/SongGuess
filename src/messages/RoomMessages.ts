import z from "zod";
import { ChangeUsernameMessageSchema, HostUpdatePlaylistMessageSchema, StartGameMessageSchema } from "./RoomClientMessages";
import { UpdateMessageSchema, CountdownMessageSchema, ServerUpdatePlaylistMessageSchema } from "./RoomServerMessages";
import { ErrorMessageSchema } from "./RoomSharedMessages";


/**
 * A message sent from a client.
 */
export const ClientMessageSchema = z.union([
  ErrorMessageSchema,
  ChangeUsernameMessageSchema,
  HostUpdatePlaylistMessageSchema,
  StartGameMessageSchema
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;


/**
 * A message sent from the server.
 */
export const ServerMessageSchema = z.union([
  ErrorMessageSchema,
  UpdateMessageSchema,
  ServerUpdatePlaylistMessageSchema,
  CountdownMessageSchema
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;