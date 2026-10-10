import type { PlayerMessage } from "../../../types/MessageTypes";
import type { PossibleShowFields } from "../../../types/PossibleShowFields";
import { PlayerCard } from "../player/PlayerCard";
import { PlayerMessageField } from "../PlayerMessageField";


export function ResultsPlayerList({ rankedPlayers, showField }:
{ rankedPlayers: PlayerMessage[]; showField: PossibleShowFields }) {
  return (
    <div className="flex flex-col gap-3 overflow-y-auto">
      {rankedPlayers.map((player, index) => (
        <div key={player.username} className="flex items-center gap-4 min-w-32">
          <div className={`flex items-center justify-center min-w-12 min-h-12 rounded-full text-lg font-bold ${
            index === 0
              ? "text-black bg-gold"
              : index === 1
                ? "text-black bg-silver"
                : index === 2
                  ? "text-black bg-bronze"
                  : "bg-card-bg"
          }`}
          >
            {index + 1}
          </div>

          <div className="flex-1 flex flex-col bg-card-hover-bg rounded-lg w-full">
            <PlayerCard player={player} forceDesktop={true}>
              <PlayerMessageField player={player} showField={showField} className="text-xl!" />
            </PlayerCard>
          </div>
        </div>
      ))}
    </div>
  );
}
