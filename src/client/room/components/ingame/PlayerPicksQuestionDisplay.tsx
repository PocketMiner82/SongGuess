import random from "lodash/random";
import { useCallback, useEffect, useState } from "react";
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


function PlayerPickingDisplay() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "question");
  useRoomControllerMessageTypeListener(controller, "audio_control");

  const pickerID = controller.roundData.currentQuestion?.pickerId;
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

function AnswerInput() {
  const controller = useControllerContext();
  const [answer, setAnswer] = useState(controller.roundData.selectedAnswer ?? "");
  const [inputDisabled, setInputDisabled] = useState(false);

  const isMyTurn = controller.userID === controller.roundData.pickerId;
  const correctSong = controller.roundData.currentAnswer?.correctSong;
  const canAnswer = controller.roundData.currentAnswer === null;

  const handleSelect = useCallback(() => {
    if (!canAnswer || !answer.trim() || controller.roundData.currentAudioState !== "play" || answer === controller.roundData.selectedAnswer) {
      return;
    }

    controller.selectAnswerText(answer.trim());
  }, [answer, canAnswer, controller]);

  useRoomControllerMessageTypeListener(controller, "audio_control", handleSelect);
  useRoomControllerMessageTypeListener(controller, "question");
  useRoomControllerMessageTypeListener(controller, "answer");

  useRoomControllerListener(controller, useCallback((msg) => {
    return msg?.type === "confirmation" && msg.sourceMessage.type === "select_answer";
  }, []));

  useEffect(() => {
    if (answer) {
      handleSelect();
    }
  }, [answer, handleSelect]);

  return (
    <>
      { isMyTurn
        ? (
            <div className="text-disabled-text text-center">
              Please wait for the other players to guess!
            </div>
          )
        : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSelect();
                setInputDisabled(true);
              }}
              className="mt-8 w-full"
            >
              <div className="flex gap-2 justify-center">
                <input
                  type="text"
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder="Enter song name…"
                  disabled={inputDisabled || !canAnswer}
                  className="flex-1 max-w-md px-4 py-2 bg-card-bg border border-gray-500 rounded focus:border-secondary outline-0 disabled:opacity-50"
                  autoFocus
                />
                <Button disabled={inputDisabled || !canAnswer || !answer.trim() || controller.roundData.currentAudioState !== "play"} type="submit">
                  Submit
                </Button>
              </div>
              {inputDisabled && (
                <div className="text-center text-disabled-text mt-2">
                  <p>Answer submitted!</p>
                  <p
                    className="text-primary underline hover:cursor-pointer"
                    onClick={() => setInputDisabled(false)}
                  >
                    Edit answer
                  </p>
                </div>
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
  );
}

export function PlayerPicksQuestionDisplay() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "question");

  const isPickingPhase = controller.roundData.currentQuestion?.isPickingPhase;
  const isMyTurn = controller.userID === controller.roundData.pickerId;

  const pickingMessage = isPickingPhase
    ? (isMyTurn ? "Select a song for others to guess" : "Wait for the picker to select a song")
    : (isMyTurn ? "You are the picker" : "Type the song title you hear");

  return (
    <div className="space-y-6 w-full lg:w-4xl xl:w-5xl">
      <h3 className="text-lg text-center font-bold">
        {pickingMessage}
      </h3>
      {isPickingPhase
        ? <PlayerPickingDisplay />
        : <AnswerInput />}
    </div>
  );
}
