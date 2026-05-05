import type { SearchMusicComponentProps } from "../components/SearchMusicComponent";
import { SearchMusicComponent } from "../components/SearchMusicComponent";
import { ModalContent } from "./ModalContent";

/**
 * A modal dialog for searching Apple Music content by URL or search term.
 * Supports searching for songs, albums, and artists.
 * Can be restricted to only accept songs via the onlyAcceptSongs prop.
 */
export function SearchMusicDialog({
  onlyAcceptSongs = false,
  onPlaylistSelected,
  onSuccess,
}: SearchMusicComponentProps) {
  return (
    <ModalContent title={onlyAcceptSongs ? "Search Songs" : "Search Apple Music"} maxWidth="full">
      <SearchMusicComponent
        onlyAcceptSongs={onlyAcceptSongs}
        onPlaylistSelected={onPlaylistSelected}
        onSuccess={onSuccess}
      />
    </ModalContent>
  );
}
