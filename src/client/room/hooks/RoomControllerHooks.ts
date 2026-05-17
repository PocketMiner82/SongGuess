import type { CookieGetter, CookieSetter } from "../../../types/CookieFunctionTypes";
import { createContext, use, useEffect, useRef } from "react";
import { RoomController } from "../RoomController";

/**
 * Custom React hook that provides a {@link RoomController} instance for managing
 * the connection and state of a room.
 *
 * @param roomID The ID of the room to connect to.
 * @param getCookies What cookies are currently set.
 * @param setCookies A function to allow updating cookies.
 * @returns An object containing a `getController` method to access the `RoomController` instance.
 */
export function useRoomController(roomID: string, getCookies: CookieGetter, setCookies: CookieSetter) {
  // hold the class instance so it persists across renders
  const controllerRef = useRef<RoomController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new RoomController(roomID, getCookies, setCookies);
  }

  useEffect(() => {
    // cleanup logic for when the component unmounts or roomID changes
    return () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [roomID]);

  return {
    getController: (): RoomController => controllerRef.current!,
    // ready if the ref is populated
    isReady: !!controllerRef.current,
  };
}

/**
 * React context for providing the RoomController instance to child components.
 */
export const RoomContext = createContext<RoomController | null>(null);

/**
 * Custom React hook to access the RoomController from the React context.
 *
 * @returns The RoomController instance.
 * @throws Error if used outside a RoomProvider.
 */
export function useControllerContext() {
  const controller = use(RoomContext);
  if (!controller)
    throw new Error("useRoom must be used within RoomProvider");
  return controller;
}
