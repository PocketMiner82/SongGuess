import type { PlayerAnswerData, PlayerMessage } from "./MessageTypes";


export type PossibleShowFields = Exclude<(keyof PlayerAnswerData | keyof PlayerMessage), "answerData">;
