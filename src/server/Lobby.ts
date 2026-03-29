import type {IEventListener} from "./listener/IEventListener";
import type {ValidRoom} from "./ValidRoom";
import type {
  AddPlaylistsMessage,
  ClientMessage, Playlist,
  RemovePlaylistMessage,
  Song, UpdatePlaylistsMessage
} from "../types/MessageTypes";
import type Player from "./Player";


export default class Lobby implements IEventListener {
  /**
   * Currently selected playlist(s)
   */
  playlists: Playlist[] = [];

  /**
   * All songs of the currently selected playlist(s)
   */
  songs: Song[] = [];


  constructor(private room: ValidRoom) {
    room.listener.registerEvents(this);
  }


  onMessage(player: Player, msg: ClientMessage): boolean {
    switch (msg.type) {
      case "add_playlists":
      case "remove_playlist":
        if (!this.room.performChecks(player, msg, "host", "lobby", "not_contdown")) {
          return true;
        }

        if (msg.type === "add_playlists") {
          let omitted = this.addPlaylists(msg);
          if (omitted > 0) {
            player.sendConfirmationOrError(msg, `${omitted}/${msg.playlists.length} playlist(s) were omitted because they don't have songs or they don't have a unique name and album cover.`);

            // everything was omitted
            if (omitted === msg.playlists.length) {
              player.safeSend(this.getPlaylistsUpdateMessage());
              return true;
            }
          }
        } else if (msg.type === "remove_playlist" && !this.removePlaylist(msg)) {
          player.sendConfirmationOrError(msg, `Index out of bounds: ${msg.index}`);
          player.safeSend(this.getPlaylistsUpdateMessage());
          return true;
        }
        // always re-filter songs after playlist update
        this.filterSongs();

        // playlist updates will force to include all songs again
        this.room.game.remainingSongs = [];

        // send the update to all players + confirmation to the host
        this.room.server.safeBroadcast(this.getPlaylistsUpdateMessage());
        player.sendConfirmationOrError(msg);
        return true;
    }
    return false;
  }

  /**
   * Adds a playlist to the current game session.
   *
   * @param msg The message containing the playlist to add.
   * @returns the amount of playlists omitted.
   */
  public addPlaylists(msg: AddPlaylistsMessage): number {
    const playlists = msg.playlists.filter(playlist =>
        playlist.songs && this.playlists.every(p =>
            p.name !== playlist.name || p.cover !== playlist.cover
        ));

    if (playlists.length > 0) {
      this.playlists.push(...playlists);
      this.room.server.logger.info(`The playlist(s) ${
          playlists.map(p => p.name).join("; ")
      } has/have been added.`);
    }

    return msg.playlists.length - playlists.length;
  }

  /**
   * Updates the songs array by collecting all songs from the current playlists.
   */
  public filterSongs(): Song[] {
    this.songs = [];
    for (let playlist of this.playlists) {
      this.songs.push(...playlist.songs);
    }

    this.songs = [
      ...new Map(this.songs.map(s => {
            // filter for unique name and artist
            let normalizedName = s.name.toLowerCase();
            let normalizedArtist = s.artist.toLowerCase();

            if (this.room.config.advancedSongFiltering) {
              // replace parens at end like "Test Song (feat. SomeArtist) [Live]" => "Test Song"
              normalizedName = normalizedName.replace(/(\s*[[(].*[)\]]\s*)+$/, "");
              normalizedName = normalizedName.replace(/[^\p{L}\p{N} ]/gu, "");
              normalizedName = normalizedName.replace(/ +/g, " ");
            }

            return [`${normalizedName}|${normalizedArtist}`, s]
          }
      )).values()
    ];

    return this.songs;
  }

  /**
   * Removes a playlist from the current game session by index.
   *
   * @param msg The message containing the index of the playlist to remove.
   * @returns true if the playlist was removed successfully, false if the index was out of bounds.
   */
  public removePlaylist(msg: RemovePlaylistMessage): boolean {
    if (msg.index !== null && msg.index >= this.playlists.length) {
      return false;
    }

    if (msg.index !== null) {
      let playlistName = this.playlists[msg.index].name;
      this.playlists.splice(msg.index, 1);
      this.room.server.logger.info(`The playlist "${playlistName}" has been removed.`);
    } else {
      this.playlists = [];
      this.room.server.logger.info(`All playlists have been removed.`);
    }
    return true;
  }

  /**
   * Constructs a playlist update message with the current playlist array.
   *
   * @param onlyCount whether to only update the filtered songs count.
   * @returns an {@link UpdatePlaylistsMessage}
   */
  public getPlaylistsUpdateMessage(onlyCount: boolean = false): UpdatePlaylistsMessage {
    return {
      type: "update_playlists",
      playlists: onlyCount ? undefined : this.playlists,
      filteredSongsCount: this.songs.length
    };
  }
}