import { SettingsRange } from "../settings/SettingsRange";


function getVolumeIcon(muted: boolean, volume: number) {
  if (muted)
    return "volume_off";
  if (volume === 0)
    return "volume_mute";
  if (volume <= 0.5)
    return "volume_down";
  return "volume_up";
}


export function AudioControls({ muted, volume, onMuteChange, onVolumeChange }: {
  muted: boolean;
  volume: number;
  onMuteChange: () => void;
  onVolumeChange: (newVolume: number) => void;
}) {
  return (
    <SettingsRange
      value={volume}
      onChange={onVolumeChange}
      displayText={`${Math.round(volume * 100)}%`}
      min={0}
      max={1}
      step={0.01}
      className="w-25 align-middle"
    >
      <button
        type="button"
        onClick={onMuteChange}
        className="flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity focus-visible:ring-2 focus-visible:ring-secondary rounded"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        <span className="material-icons text-default" aria-hidden="true">
          {getVolumeIcon(muted, volume)}
        </span>
      </button>
    </SettingsRange>
  );
}
