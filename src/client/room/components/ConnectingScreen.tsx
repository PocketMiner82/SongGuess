/**
 * Screen displayed while the room controller is initializing and (re-)connecting.
 */
export function ConnectingScreen({ roomID }: { roomID: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="material-symbols-outlined animate-spin text-gray-500 mb-8" role="img" aria-label="Loading">
        progress_activity
      </div>
      <div className="text-2xl">
        Connecting to
        {" "}
        {roomID}
        …
      </div>
    </div>
  );
}
