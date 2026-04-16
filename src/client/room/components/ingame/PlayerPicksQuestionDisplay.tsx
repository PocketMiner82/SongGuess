import {
  useControllerContext,
  useRoomControllerListener,
  useRoomControllerMessageTypeListener
} from "../../RoomController";
import {useCallback, useEffect, useState} from "react";
import {ProgressBar} from "./ProgressBar";
import {ROUND_PADDING_TICKS} from "../../../../ConfigConstants";
import {Button} from "../../../components/Button";
import {PlayerAvatar} from "../PlayerAvatar";
import {PlaylistCard} from "../../../components/PlaylistCard";
import {Modal} from "../../../modal/Modal";
import {SearchMusicDialog} from "../../../modal/SearchMusicDialog";
import {getPlaylistByURL} from "../../../../Utils";
import _ from "lodash";

function PlayerPickingDisplay() {
  const controller = useControllerContext();
  const [canPick, setCanPick] = useState(false);

  useRoomControllerMessageTypeListener(controller, "question");
  useRoomControllerMessageTypeListener(controller, "audio_control");

  const pickerID = controller.ingameData.currentQuestion?.pickerId;
  const isMyTurn = controller.userID === pickerID;

  useEffect(() => {
    const question = controller.ingameData.currentQuestion;
    if (question?.pickerId && isMyTurn) {
      setCanPick(true);
    } else {
      setCanPick(false);
    }
  }, [controller.ingameData.currentQuestion, isMyTurn]);

  const handlePickSong = useCallback(async (url: string) => {
    const playlist = await getPlaylistByURL(url);
    if (playlist && playlist.songs && playlist.songs.length > 0) {
      controller.pickSong(playlist.songs[0], controller.config.audioStartPosition === 3 ? _.random(0, 2) : controller.config.audioStartPosition);
      return true;
    }
    return false;
  }, [controller]);

  const pickerPlayer = pickerID ? controller.players.get(pickerID) : null;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">
          {isMyTurn ? "Your turn to pick a song!" : `${pickerPlayer?.username || "Player"} is picking a song`}
        </h2>
        <p className="text-disabled-text">
          {isMyTurn ? "Select a song for others to guess" : "Wait for the picker to select a song"}
        </p>
      </div>

      {isMyTurn && canPick && (
        <div className="flex justify-center">
          <Button onClick={() => {
            Modal.open(SearchMusicDialog, {
              onlyAcceptSongs: true,
              onPlaylistSelected: handlePickSong
            });
          }}>
            <span className="material-symbols-outlined mr-2">music_note</span>
            Pick a Song
          </Button>
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
  const [canAnswer, setCanAnswer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [answer, setAnswer] = useState("");
  const [hasAnswered, setHasAnswered] = useState(false);

  useRoomControllerMessageTypeListener(controller, "audio_control");

  useRoomControllerListener(controller, useCallback(msg => {
    if (msg?.type === "question") {
      setIsPlaying(false);
      setHasAnswered(false);
      setAnswer("");
      return true;
    } else if (msg?.type === "answer") {
      setCanAnswer(false);
      setIsPlaying(false);
      return true;
    } else if (msg?.type === "confirmation" && msg.sourceMessage.type === "select_answer") {
      setHasAnswered(true);
      return true;
    }
    return false;
  }, []));

  useEffect(() => {
    if (controller.ingameData.currentAudioState === "play") {
      setCanAnswer(controller.ingameData.currentAnswer === null && !hasAnswered);
      setIsPlaying(controller.ingameData.currentAnswer === null);
    } else if (controller.ingameData.currentAudioState === "load") {
      setIsPlaying(true);
      setCanAnswer(false);
    } else {
      setIsPlaying(false);
      setCanAnswer(false);
    }
  }, [controller.ingameData.currentAudioState, controller.ingameData.currentAnswer, hasAnswered]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!canAnswer || !answer.trim()) return;
    controller.selectAnswerText(answer.trim());
    setHasAnswered(true);
  }, [canAnswer, answer, controller]);

  if (!controller.ingameData.currentQuestion && !controller.ingameData.currentAnswer) {
    return (
        <>
          <div className="material-symbols-outlined animate-spin text-gray-500 mb-8" role="img" aria-label="Loading">progress_activity</div>
          <div className="text-2xl">Loading question…</div>
        </>
    );
  }

  const isPickingPhase = controller.ingameData.currentQuestion?.pickerId != null;
  const questionNumber = controller.ingameData.currentQuestion?.number || controller.ingameData.currentAnswer?.number;

  if (isPickingPhase) {
    return <PlayerPickingDisplay />;
  }

  const correctSong = controller.ingameData.currentAnswer?.correctSong;

  return (
    <div className="space-y-6 w-full lg:w-4xl xl:w-5xl">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">
          Question {questionNumber!}/{controller.config.questionsCount}
        </h2>
        <p className="text-disabled-text">
          Type the song title you hear
        </p>
      </div>

      <div className="mx-auto w-3/4">
        <ProgressBar 
          duration={controller.ingameData.currentAudioState === "load"
              ? -(ROUND_PADDING_TICKS - 0.5)
              : controller.config.timePerQuestion - 0.5
          } 
          isPlaying={isPlaying} 
          positionOffset={controller.ingameData.currentAudioPosition} 
        />
      </div>

      <form onSubmit={handleSubmit} className="mt-8 w-full">
        <div className="flex gap-2 justify-center">
          <input
            type="text"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="Enter song name…"
            disabled={!canAnswer || hasAnswered}
            className="flex-1 max-w-md px-4 py-2 bg-card-bg border border-gray-500 rounded focus:border-secondary outline-0 disabled:opacity-50"
          />
          <Button disabled={!canAnswer || hasAnswered || !answer.trim()}>
            Submit
          </Button>
        </div>
        {hasAnswered && (
          <p className="text-center text-disabled-text mt-2">Answer submitted!</p>
        )}
      </form>

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
    </div>
  );
}

export function PlayerPicksQuestionDisplay() {
  return <AnswerInput />;
}