import random from "lodash/random";
import * as React from "react";
import { useCallback, useState } from "react";
import { getPlaylistByURL } from "../../../../Utils";
import { Button } from "../../../components/Button";
import { PlaylistCard } from "../../../components/PlaylistCard";
import { SearchMusicComponent } from "../../../components/SearchMusicComponent";
import {
  useControllerContext,
  useRoomControllerListener,
  useRoomControllerMessageTypeListener,
} from "../../RoomController";
import { PlayerAvatar } from "../PlayerAvatar";


type AnswerPhase = "loading" | "answering" | "answered";

function PlayerPickingDisplay() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "question");
  useRoomControllerMessageTypeListener(controller, "audio_control");

  const pickerID = controller.ingameData.currentQuestion?.pickerId;
  const isMyTurn = controller.userID === pickerID;

  const handlePickSong = useCallback(async (url: string) => {
    const playlist = await getPlaylistByURL(url);
    if (playlist && playlist.songs && playlist.songs.length > 0) {
      controller.pickSong(playlist.songs[0], controller.config.audioStartPosition === 3 ? random(0, 2) : controller.config.audioStartPosition);
      return true;
    }
    return false;
  }, [controller]);

  const pickerPlayer = pickerID ? controller.players.get(pickerID) : null;

  return (
    <div className="space-y-6 w-full">
      {isMyTurn && (
        <div className="flex justify-center max-h-[calc(100vh-20rem)]">
          <SearchMusicComponent onlyAcceptSongs={true} onPlaylistSelected={handlePickSong} />
        </div>
      )}

      {!isMyTurn && pickerPlayer && (
        <div className="flex justify-center">
          <PlayerAvatar size={64} player={pickerPlayer} />
        </div>
      )}
    </div>
  );
}

export function PlayerPicksQuestionDisplay() {
  const controller = useControllerContext();
  const isPickingPhase = controller.ingameData.currentQuestion?.isPickingPhase;
  const isMyTurn = controller.userID === controller.ingameData.currentQuestion?.pickerId;
  const pickingMessage = isPickingPhase
    ? (isMyTurn ? "Select a song for others to guess" : "Wait for the picker to select a song")
    : (isMyTurn ? "You are the picker" : "Type the song title you hear");

  const [phase, setPhase] = useState<AnswerPhase>("loading");
  const [answer, setAnswer] = useState("");

  useRoomControllerMessageTypeListener(controller, "audio_control");

  useRoomControllerListener(controller, useCallback((msg) => {
    if (msg?.type === "question") {
      setPhase("answering");
      setAnswer("");
      return true;
    } else if (msg?.type === "answer") {
      setPhase("loading");
      return true;
    } else if (msg?.type === "confirmation" && msg.sourceMessage.type === "select_answer") {
      setPhase("answered");
      return true;
    }
    return false;
  }, []));

  if (controller.ingameData.currentAudioState === "play") {
    const canAnswer = controller.ingameData.currentAnswer === null && phase !== "answered";
    setPhase(canAnswer ? "answering" : phase);
  } else if (controller.ingameData.currentAudioState === "load") {
    setPhase("loading");
  } else {
    setPhase("loading");
  }

  const handleSubmit = useCallback((e: React.SubmitEvent) => {
    e.preventDefault();
    if (phase !== "answering" || !answer.trim())
      return;
    controller.selectAnswerText(answer.trim());
    setPhase("answered");
  }, [phase, answer, controller]);

  const correctSong = controller.ingameData.currentAnswer?.correctSong;
  const canAnswer = phase === "answering";
  const hasAnswered = phase === "answered";

  return (
    <div className="space-y-6 w-full lg:w-4xl xl:w-5xl">
      <h3 className="text-lg text-center font-bold">
        {pickingMessage}
      </h3>
      {isPickingPhase && <PlayerPickingDisplay />}

      {!isPickingPhase && (
        <>
          { isMyTurn
            ? (
                <div className="text-disabled-text text-center">
                  Please wait for the other players to guess!
                </div>
              )
            : (
                <form onSubmit={handleSubmit} className="mt-8 w-full">
                  <div className="flex gap-2 justify-center">
                    <input
                      type="text"
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      placeholder="Enter song name…"
                      disabled={!canAnswer}
                      className="flex-1 max-w-md px-4 py-2 bg-card-bg border border-gray-500 rounded focus:border-secondary outline-0 disabled:opacity-50"
                    />
                    <Button disabled={!canAnswer || !answer.trim()}>
                      Submit
                    </Button>
                  </div>
                  {hasAnswered && (
                    <p className="text-center text-disabled-text mt-2">Answer submitted!</p>
                  )}
                </form>
              )}

          {correctSong && (
            <div className="mt-4">
              <PlaylistCard
                title={correctSong.name}
                subtitle={correctSong.artist}
                coverURL={correctSong.cover}
                hrefURL={correctSong.hrefURL}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
