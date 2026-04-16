import random from "lodash/random";
import React, { useCallback, useEffect, useState } from "react";
import { ROUND_PADDING_TICKS } from "../../../../ConfigConstants";
import { getPlaylistByURL } from "../../../../Utils";
import { Button } from "../../../components/Button";
import { PlaylistCard } from "../../../components/PlaylistCard";
import { Modal } from "../../../modal/Modal";
import { SearchMusicDialog } from "../../../modal/SearchMusicDialog";
import {
  useControllerContext,
  useRoomControllerListener,
  useRoomControllerMessageTypeListener,
} from "../../RoomController";
import { PlayerAvatar } from "../PlayerAvatar";
import { ProgressBar } from "./ProgressBar";


type AnswerPhase = "loading" | "answering" | "answered";

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
      controller.pickSong(playlist.songs[0], controller.config.audioStartPosition === 3 ? random(0, 2) : controller.config.audioStartPosition);
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
              onPlaylistSelected: handlePickSong,
              id: `PlayerPicksSearchMusicDialog${Date.now()}`,
            });
          }}
          >
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

  useEffect(() => {
    if (controller.ingameData.currentAudioState === "play") {
      const canAnswer = controller.ingameData.currentAnswer === null && phase !== "answered";
      setPhase(canAnswer ? "answering" : phase);
    } else if (controller.ingameData.currentAudioState === "load") {
      setPhase("loading");
    } else {
      setPhase("loading");
    }
  }, [controller.ingameData.currentAudioState, controller.ingameData.currentAnswer, phase]);

  const handleSubmit = useCallback((e: React.SubmitEvent) => {
    e.preventDefault();
    if (phase !== "answering" || !answer.trim())
      return;
    controller.selectAnswerText(answer.trim());
    setPhase("answered");
  }, [phase, answer, controller]);

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
  const canAnswer = phase === "answering";
  const hasAnswered = phase === "answered";

  return (
    <div className="space-y-6 w-full lg:w-4xl xl:w-5xl">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">
          Question
          {" "}
          {questionNumber!}
          /
          {controller.config.questionsCount}
        </h2>
        <p className="text-disabled-text">
          Type the song title you hear
        </p>
      </div>

      <div className="mx-auto w-3/4">
        <ProgressBar
          duration={controller.ingameData.currentAudioState === "load"
            ? -(ROUND_PADDING_TICKS - 0.5)
            : controller.config.timePerQuestion - 0.5}
          isPlaying={controller.ingameData.currentAnswer === null}
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
