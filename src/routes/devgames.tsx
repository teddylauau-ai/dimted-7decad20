import { createFileRoute } from "@tanstack/react-router";
import { TowerStack } from "@/components/games/TowerStack";
import { LaneHop } from "@/components/games/LaneHop";
import { NeonCoil } from "@/components/games/NeonCoil";

export const Route = createFileRoute("/devgames")({
  ssr: false,
  component: DevGames,
});

function DevGames() {
  const noop = () => {};
  return (
    <div className="flex flex-wrap gap-6 p-6">
      <TowerStack running onScore={noop} onEnd={noop} />
      <LaneHop running onScore={noop} onEnd={noop} />
      <NeonCoil running onScore={noop} onEnd={noop} />
    </div>
  );
}
