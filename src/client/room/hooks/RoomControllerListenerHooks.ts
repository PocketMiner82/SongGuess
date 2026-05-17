import type { ServerMessage } from "../../../types/MessageTypes";
import type { RoomController } from "../RoomController";
import * as React from "react";
import { useCallback, useEffect } from "react";

/**
 * A callback function that receives the RoomController instance when its state changes and returns a boolean
 * to indicate whether the update should trigger a component update, therefore also making new controller accissible.
 */
export type ListenerCallback = (msg: ServerMessage | null) => boolean | void;

/**
 * Custom React hook to subscribe to state changes in a {@link RoomController}.
 * @param controller The RoomController instance to listen to.
 * @param cb The {@link ListenerCallback} function.
 */
export function useRoomControllerListener(controller: RoomController, cb: ListenerCallback) {
  const [updateVal, setUpdateVal] = React.useState(false);
  // eslint-disable-next-line react/set-state-in-effect
  const forceUpdateComponent = React.useCallback(() => setUpdateVal(!updateVal), [updateVal]);

  useEffect(() => {
    if (cb(null) ?? true) {
      forceUpdateComponent();
    }

    return controller.registerOnStateChangeListener((msg) => {
      const update = cb(msg) ?? true;
      if (update) {
        forceUpdateComponent();
      }
      return update;
    });
  }, [controller, cb, forceUpdateComponent]);
}

/**
 * A wrapper around {@link useRoomControllerListener} that forces a React update when the specified message is received.
 * @param controller The RoomController instance to listen to.
 * @param msgType The {@link ServerMessage["type"]} to listen for.
 * @param cb Optional callback invoked when the message is received.
 */
export function useRoomControllerMessageTypeListener<T extends ServerMessage["type"] | null>(
  controller: RoomController,
  msgType: T,
  cb?: (msg: Extract<ServerMessage, { type: T }> | (T extends null ? null : never)) => boolean | void,
) {
  useRoomControllerListener(controller, useCallback((msg) => {
    const matches = (msg?.type ?? null) === msgType;

    if (matches && cb) {
      return cb(msg as any);
    }
    return matches;
  }, [msgType, cb]));
}
