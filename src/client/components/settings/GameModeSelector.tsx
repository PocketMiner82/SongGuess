import * as React from "react";
import { useControllerContext } from "../../hooks/RoomControllerHooks";


export function GameModeSelector({ disabled }: { disabled?: boolean }) {
  const controller = useControllerContext();

  const handleKeyDown = (e: React.KeyboardEvent, currentMode: string) => {
    if (disabled)
      return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const newMode = currentMode === "multiple_choice" ? "player_picks" : "multiple_choice";
      controller.config.gameMode = newMode as "multiple_choice" | "player_picks";
      controller.sendConfig();
    }
  };

  return (
    <div className={`mb-1 ${disabled ? "opacity-50" : ""}`}>
      <div className="flex border-b border-disabled-bg" role="tablist">
        <button
          type="button"
          role="tab"
          disabled={disabled}
          aria-selected={controller.config.gameMode === "multiple_choice"}
          tabIndex={controller.config.gameMode === "multiple_choice" ? 0 : -1}
          onClick={() => {
            if (disabled)
              return;
            controller.config.gameMode = "multiple_choice";
            controller.sendConfig();
          }}
          onKeyDown={e => handleKeyDown(e, controller.config.gameMode)}
          className={`flex-1 py-2 px-4 text-center transition-colors focus-visible:ring-2 focus-visible:ring-secondary ${
            controller.config.gameMode === "multiple_choice"
              ? "border-b-2 border-secondary text-secondary"
              : "text-disabled-text"
          } ${disabled ? "cursor-not-allowed" : "hover:cursor-pointer"}`}
        >
          Multiple Choice
        </button>
        <button
          type="button"
          role="tab"
          disabled={disabled}
          aria-selected={controller.config.gameMode === "player_picks"}
          tabIndex={controller.config.gameMode === "player_picks" ? 0 : -1}
          onClick={() => {
            if (disabled)
              return;
            controller.config.gameMode = "player_picks";
            controller.sendConfig();
          }}
          onKeyDown={e => handleKeyDown(e, controller.config.gameMode)}
          className={`flex-1 py-2 px-4 text-center transition-colors focus-visible:ring-2 focus-visible:ring-secondary ${
            controller.config.gameMode === "player_picks"
              ? "border-b-2 border-secondary text-secondary"
              : "text-disabled-text"
          } ${disabled ? "cursor-not-allowed" : "hover:cursor-pointer"}`}
        >
          Player Picks
        </button>
      </div>
    </div>
  );
}
