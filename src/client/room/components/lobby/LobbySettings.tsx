import { useControllerContext } from "../../hooks/RoomControllerHooks";
import { useRoomControllerMessageTypeListener } from "../../hooks/RoomControllerListenerHooks";
import { AddPlaylistButton } from "../settings/buttons/AddPlaylistButton";
import { ClearPlaylistsButton } from "../settings/buttons/ClearPlaylistsButton";
import { CopyLinkButton } from "../settings/buttons/CopyLinkButton";
import { ImportPlaylistsButton } from "../settings/buttons/ImportPlaylistsButton";
import { StartGame } from "../settings/buttons/StartGameButton";
import { GameModeSelector } from "../settings/GameModeSelector";
import { SettingsDropdown } from "../settings/SettingsDropdown";
import { SettingsNumberInput } from "../settings/SettingsInput";
import { SettingsToggle } from "../settings/SettingsToggle";


export function Settings({ disabled }: { disabled?: boolean }) {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "room_config");

  return (
    <div className="mb-8">
      <h3 className="text-xl font-bold mb-3">Settings</h3>

      <div className="grid gap-4">
        <GameModeSelector disabled={disabled} />

        {controller.config.gameMode === "multiple_choice" && (
          <>
            <ImportPlaylistsButton disabled={disabled} />

            <div className="flex flex-wrap gap-4 w-full">
              <AddPlaylistButton disabled={disabled} />
              <ClearPlaylistsButton disabled={disabled} />
            </div>

            <div className="border-t border-disabled-bg my-1"></div>

            <SettingsToggle
              value={controller.config.advancedSongFiltering}
              disabled={disabled}
              onToggle={(v) => {
                controller.config.advancedSongFiltering = v;
                controller.sendConfig();
              }}
            >
              Perform advanced song filtering
            </SettingsToggle>

            <SettingsToggle
              value={controller.config.distractionsPreferSameArtist}
              disabled={disabled}
              onToggle={(v) => {
                controller.config.distractionsPreferSameArtist = v;
                controller.sendConfig();
              }}
            >
              Distractions: Prefer songs by same artist
            </SettingsToggle>

            <SettingsToggle
              value={controller.config.endWhenAnswered}
              disabled={disabled}
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
              disabled={disabled}
              onChange={(v) => {
                controller.config.playerPickTimeout = v;
                controller.sendConfig();
              }}
              min={60}
              max={300}
            >
              Song pick timeout (60-300s)
            </SettingsNumberInput>

            <div className="border-t border-disabled-bg my-1"></div>
          </>
        )}

        <SettingsNumberInput
          value={controller.config.roundsCount}
          disabled={disabled}
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
          disabled={disabled}
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
          value={controller.config.audioStartPosition ?? -1}
          disabled={disabled}
          onChange={(v) => {
            controller.config.audioStartPosition = v === -1 ? null : v;
            controller.sendConfig();
          }}
          options={[
            { value: 0, label: "Start of audio" },
            { value: 0.5, label: "Close to middle" },
            { value: 1, label: "Close to end" },
            { value: -1, label: controller.config.gameMode === "player_picks" ? "Picker decides" : "Randomize above" },
          ]}
        >
          Audio start position
        </SettingsDropdown>

        <div className="border-t border-disabled-bg my-1"></div>

        <div className="flex flex-wrap gap-4">
          <CopyLinkButton />
          <StartGame disabled={disabled} />
        </div>
      </div>
    </div>
  );
}
