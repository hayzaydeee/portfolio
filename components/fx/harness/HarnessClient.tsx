"use client";

import { useMemo, useRef } from "react";
import { FxStage, type FxHandle } from "@/components/fx/FxStage";
import type { FxId } from "@/components/fx/metas";
import { ROOM_POSTER_CLASS } from "@/components/fx/posters";
import type { RoomKey } from "@/components/fx/runtime/types";
import { useAudio, type PlayableTrack } from "@/lib/audio/AudioContext";

const FIXTURE_TRACK: PlayableTrack = {
  id: "fx-test-kick",
  music_project_id: "fx-test",
  title: "kick fixture",
  audio_path: "/fx-test/kick.mp3",
  duration_seconds: 10,
  track_number: 1,
  created_at: "2026-01-01T00:00:00Z",
};

export function HarnessClient({
  effect,
  room,
  sourcePalette,
  withAudio,
}: {
  effect: FxId;
  room: RoomKey;
  sourcePalette: boolean;
  withAudio: boolean;
}) {
  const handle = useRef<FxHandle>(null);
  const { play } = useAudio();
  const options = useMemo(() => ({ sourcePalette }), [sourcePalette]);

  return (
    <main className="relative h-screen w-full">
      <FxStage
        effect={effect}
        room={room}
        options={options}
        handle={handle}
        className="absolute inset-0"
        posterClassName={ROOM_POSTER_CLASS[room]}
      />
      {withAudio && (
        <button
          type="button"
          data-testid="play-fixture"
          onClick={() => play(FIXTURE_TRACK, [FIXTURE_TRACK])}
          className="absolute left-4 top-4 rounded-md bg-black/60 px-3 py-1.5 font-mono text-xs text-white"
        >
          play fixture
        </button>
      )}
    </main>
  );
}
