import { useControllerContext, useRoomControllerMessageTypeListener } from "../../RoomController";
import { GameModeSelector } from "../settings/GameModeSelector";
import { SettingsDropdown } from "../settings/SettingsDropdown";
import { SettingsNumberInput } from "../settings/SettingsInput";
import { SettingsToggle } from "../settings/SettingsToggle";
import { AddPlaylistButton } from "./buttons/AddPlaylistButton";
import { ClearPlaylistsButton } from "./buttons/ClearPlaylistsButton";
import { CopyLinkButton } from "./buttons/CopyLinkButton";
import { ImportPlaylistsButton } from "./buttons/ImportPlaylistsButton";
import { StartGame } from "./buttons/StartGameButton";


export function Settings() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "room_config");

  return (
    <div>
      <h3 className="text-xl font-bold mb-3">Settings</h3>

      <div className="grid gap-4">
        <GameModeSelector />

        {controller.config.gameMode === "multiple_choice" && (
          <>
            <AddPlaylistButton />

            <div className="grid grid-cols-2 gap-4">
              <ClearPlaylistsButton />
              <ImportPlaylistsButton />
            </div>

            <div className="border-t border-disabled-bg my-1"></div>

            <SettingsToggle
              value={controller.config.advancedSongFiltering}
              onToggle={(v) => {
                controller.config.advancedSongFiltering = v;
                controller.sendConfig();
              }}
            >
              Perform advanced song filtering
            </SettingsToggle>

            <SettingsToggle
              value={controller.config.distractionsPreferSameArtist}
              onToggle={(v) => {
                controller.config.distractionsPreferSameArtist = v;
                controller.sendConfig();
              }}
            >
              Distractions: Prefer songs by same artist
            </SettingsToggle>

            <SettingsToggle
              value={controller.config.endWhenAnswered}
              onToggle={(v) => {
                controller.config.endWhenAnswered = v;
                controller.sendConfig();
              }}
            >
              End round when all players answered
            </SettingsToggle>

            <div className="border-t border-disabled-bg my-1"></div>
          </>
        )}

        {controller.config.gameMode === "player_picks" && (
          <>
            <SettingsNumberInput
              value={controller.config.playerPickTimeout}
              onChange={(v) => {
                controller.config.playerPickTimeout = v;
                controller.sendConfig();
              }}
              min={30}
              max={300}
            >
              Song pick timeout (30-300s)
            </SettingsNumberInput>

            <div className="border-t border-disabled-bg my-1"></div>
          </>
        )}

        <SettingsNumberInput
          value={controller.config.roundsCount}
          onChange={(v) => {
            controller.config.roundsCount = v;
            controller.sendConfig();
          }}
          min={1}
          max={30}
        >
          Number of rounds (1-30)
        </SettingsNumberInput>

        <SettingsNumberInput
          value={controller.config.timePerQuestion}
          onChange={(v) => {
            controller.config.timePerQuestion = v;
            controller.sendConfig();
          }}
          min={5}
          max={25}
        >
          Time per question (5-25s)
        </SettingsNumberInput>

        <SettingsDropdown
          value={controller.config.audioStartPosition}
          onChange={(v) => {
            controller.config.audioStartPosition = v;
            controller.sendConfig();
          }}
          options={[
            { value: 0, label: "Start of audio" },
            { value: 1, label: "Close to middle" },
            { value: 2, label: "Close to end" },
            { value: 3, label: controller.config.gameMode === "player_picks" ? "Picker decides" : "Randomize above" },
          ]}
        >
          Audio start position
        </SettingsDropdown>

        <div className="border-t border-disabled-bg my-1"></div>

        <div className="grid grid-cols-2 gap-4">
          <CopyLinkButton />
          <StartGame />
        </div>
      </div>
    </div>
  );
}
