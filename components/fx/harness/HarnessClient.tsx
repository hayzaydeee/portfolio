"use client";

import { useMemo, useRef, useState } from "react";
import { FxStage, type FxHandle } from "@/components/fx/FxStage";
import type { FxId } from "@/components/fx/metas";
import { ROOM_POSTER_CLASS } from "@/components/fx/posters";
import type { RoomKey } from "@/components/fx/runtime/types";
import { useAudio, type PlayableTrack } from "@/lib/audio/AudioContext";

function fixtureTrack(src: string): PlayableTrack {
  return {
    id: "fx-test-kick",
    music_project_id: "fx-test",
    title: "kick fixture",
    audio_path: src,
    duration_seconds: 10,
    track_number: 1,
    created_at: "2026-01-01T00:00:00Z",
  };
}

export function HarnessClient({
  effect,
  room,
  sourcePalette,
  withAudio,
  audioSrc,
  count,
}: {
  effect: FxId;
  room: RoomKey;
  sourcePalette: boolean;
  withAudio: boolean;
  audioSrc: string;
  count: number;
}) {
  const handle = useRef<FxHandle>(null);
  const { play } = useAudio();
  const options = useMemo(() => ({ sourcePalette }), [sourcePalette]);
  // Grid mode exercises the context budget: more stages than slots, then free some up
  const [start, setStart] = useState(0);
  const track = useMemo(() => fixtureTrack(audioSrc), [audioSrc]);

  return (
    <main className="relative h-screen w-full">
      {count === 1 ? (
        <FxStage
          effect={effect}
          room={room}
          options={options}
          handle={handle}
          className="absolute inset-0"
          posterClassName={ROOM_POSTER_CLASS[room]}
        />
      ) : (
        <div className="grid h-full grid-cols-4 gap-1 p-1">
          {Array.from({ length: count - start }, (_, j) => start + j).map((i) => (
            <FxStage
              key={i}
              effect={effect}
              room={room}
              options={options}
              priority={1}
              className="h-full min-h-40"
              posterClassName={ROOM_POSTER_CLASS[room]}
            />
          ))}
        </div>
      )}
      <div className="absolute left-4 top-4 flex gap-2">
        {withAudio && (
          <button
            type="button"
            data-testid="play-fixture"
            onClick={() => play(track, [track])}
            className="rounded-md bg-black/60 px-3 py-1.5 font-mono text-xs text-white"
          >
            play fixture
          </button>
        )}
        {count > 1 && (
          <button
            type="button"
            data-testid="remove-two"
            onClick={() => setStart((s) => Math.min(count, s + 2))}
            className="rounded-md bg-black/60 px-3 py-1.5 font-mono text-xs text-white"
          >
            remove first two
          </button>
        )}
      </div>
    </main>
  );
}
