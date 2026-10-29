import type { SearchMusicComponentProps } from "../SearchMusicComponent";
import { SearchMusicComponent } from "../SearchMusicComponent";
import { ModalContent } from "./ModalContent";

/**
 * A util dialog for searching Apple Music content by URL or search term.
 * Supports searching for songs, albums, and artists.
 * Can be restricted to only accept songs via the playerPicksMode prop.
 */
export function SearchMusicDialog({
  playerPicksMode = false,
  onPlaylistSelected,
  onSuccess,
}: SearchMusicComponentProps) {
  return (
    <ModalContent title={playerPicksMode ? "Search Songs" : "Search Apple Music"} maxWidth="full">
      <SearchMusicComponent
        playerPicksMode={playerPicksMode}
        onPlaylistSelected={onPlaylistSelected}
        onSuccess={onSuccess}
      />
    </ModalContent>
  );
}
