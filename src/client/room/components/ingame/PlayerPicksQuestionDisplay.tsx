import type { Playlist } from "../../../../types/MessageTypes";
import random from "lodash/random";
import { useCallback, useEffect, useState } from "react";
import GamePhase from "../../../../shared/game/GamePhase";
import { Button } from "../../../components/Button";
import { PlaylistCard } from "../../../components/PlaylistCard";
import { SearchMusicComponent } from "../../../components/SearchMusicComponent";
import {
  useControllerContext,
  useRoomControllerListener,
  useRoomControllerMessageTypeListener,
} from "../../RoomController";
import { SettingsDropdown } from "../settings/SettingsDropdown";


function PlayerPickingDisplay() {
  const controller = useControllerContext();
  const [audioStartPos, setAudioStartPos] = useState(() => {
    return controller.config.audioStartPosition === 3
      ? random(0, 2)
      : controller.config.audioStartPosition;
  });
  useRoomControllerMessageTypeListener(controller, "audio_control");
  useRoomControllerListener(controller, useCallback((msg) => {
    return msg?.type === "confirmation" && msg.sourceMessage.type === "player_pick_song";
  }, []));

  const pickedSong = controller.questionData.pickedSong;

  const handlePickSong = useCallback(async (playlist: Playlist) => {
    // TODO: maybe check here if the song can actually be downloaded?
    if (playlist.songs.length > 0 && !pickedSong) {
      controller.pickSong(playlist.songs[0], audioStartPos);
      return true;
    }

    return false;
  }, [audioStartPos, controller, pickedSong]);

  return (
    <div className="space-y-6 w-full">
      { !pickedSong
        ? (
            <div>
              {controller.config.audioStartPosition === 3 && (
                <SettingsDropdown
                  value={audioStartPos}
                  onChange={(v) => {
                    setAudioStartPos(v);
                  }}
                  options={[
                    { value: 0, label: "Start of audio" },
                    { value: 1, label: "Close to middle" },
                    { value: 2, label: "Close to end" },
                  ]}
                >
                  Audio start position for this round
                </SettingsDropdown>
              )}

              <div className="mt-2 flex justify-center max-h-[calc(100vh-21rem)] min-h-0">
                <SearchMusicComponent
                  onlyAcceptSongs={true}
                  onPlaylistSelected={handlePickSong}
                  audioStartPos={audioStartPos}
                />
              </div>
            </div>
          )
        : (
            <>
              <div className="text-disabled-text text-center mb-2">
                <p>Song submitted!</p>
                <p>Waiting for other players to pick...</p>
              </div>
              <PlaylistCard
                title={pickedSong.name}
                subtitle={pickedSong.artist}
                coverURL={pickedSong.cover}
                hrefURL={pickedSong.hrefURL}
              />
            </>

          )}
    </div>
  );
}

function AnswerInput() {
  const controller = useControllerContext();
  const [answer, setAnswer] = useState(controller.questionData.selectedAnswer ?? "");
  const [inputDisabled, setInputDisabled] = useState(false);

  const roundMsg = controller.questionData.roundMsg;
  const correctSong = roundMsg?.question?.questionType === "player_picks"
    ? roundMsg?.question?.correctAnswer
    : undefined;
  const canAnswer = roundMsg?.gamePhase === GamePhase.ANSWERING;
  const isMyQuestion = roundMsg?.question?.questionType === "player_picks"
    ? controller.uuid === roundMsg?.question?.pickerId
    : false;

  const handleSelect = useCallback(() => {
    if (!canAnswer || !answer.trim() || answer === controller.questionData.selectedAnswer || isMyQuestion) {
      return;
    }

    controller.selectAnswerText(answer.trim());
  }, [answer, canAnswer, controller, isMyQuestion]);

  useRoomControllerMessageTypeListener(controller, "round_state", (msg) => {
    handleSelect();

    if (msg.gamePhase === GamePhase.QUESTION) {
      setAnswer(controller.questionData.selectedAnswer ?? "");
      setInputDisabled(false);
    }
  });

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
      { isMyQuestion
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
                  disabled={inputDisabled}
                  className="flex-1 max-w-md px-4 py-2 bg-card-bg border border-gray-500 rounded focus:border-secondary outline-0 disabled:opacity-50"
                  autoFocus
                />
                <Button disabled={inputDisabled || !answer.trim() || !canAnswer} type="submit">
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
  useRoomControllerMessageTypeListener(controller, "round_state");

  const roundMsg = controller.questionData.roundMsg;
  const isPickingPhase = roundMsg?.gamePhase === GamePhase.PICKING;
  const isMyQuestion = roundMsg?.question?.questionType === "player_picks"
    ? controller.uuid === roundMsg?.question?.pickerId
    : false;

  const pickingMessage = isPickingPhase
    ? "Select a song for others to guess"
    : (isMyQuestion ? "This is your question" : "Type the song title you hear");

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
