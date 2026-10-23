// One Journeys with Time clip: stillness → voice with captions and changing scenes → end frame.
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Sequence, Video, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FPS, INTRO, OUTRO, ZONE, type ClipProps } from "./brand";
import { Ground } from "./parts/Ground";
import { Stage, type Shot } from "./parts/Stage";
import { Captions, chunk } from "./parts/Captions";
import { FieldNotes } from "./parts/FieldNotes";
import { TitleCard, EndFrame } from "./parts/Cards";
import { ArtStage } from "./parts/ArtStage";
import { Finish } from "./parts/Finish";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const JWTClip: React.FC<ClipProps> = ({ title, n, total, audio, episode, words, loop, shots }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const endStart = durationInFrames - OUTRO;
  const chunks = useMemo(() => chunk(words), [words]);
  const stage: Shot[] = useMemo(() => {
    const list = shots && shots.length ? shots : [{ atMs: 0, scene: "sphere" }];
    return list.map((s, i) => ({ ...s, from: i === 0 ? 0 : INTRO + Math.round((s.atMs / 1000) * FPS) }));
  }, [shots]);
  const ms = ((f - INTRO) / FPS) * 1000;
  const hasArt = stage.some((s) => s.art);

  const appear = interpolate(f, [0, 30], [0, 1], clamp);
  const toEnd = interpolate(f, [endStart - 6, endStart + 24], [0, 1], clamp);
  const titleOpacity = interpolate(f, [8, 22, INTRO + 4, INTRO + 18], [0, 1, 1, 0], clamp);
  const notesShow = interpolate(f, [INTRO, INTRO + 15], [0, 1], clamp) * (1 - toEnd);
  const progress = interpolate(f, [INTRO, endStart], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Ground />
      {loop ? (
        <AbsoluteFill style={{ opacity: appear * (1 - toEnd * 0.5) }}>
          <Video src={staticFile(loop)} loop muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      ) : (
        <>
          {hasArt ? <ArtStage shots={stage} total={durationInFrames} fade={toEnd} /> : null}
          <Stage shots={stage} cx={540} cy={ZONE.visualCy} fade={toEnd} overArt={hasArt} />
        </>
      )}
      <Finish />
      <FieldNotes n={n} total={total} progress={progress} show={notesShow} audio={audio} episode={episode} />
      <TitleCard title={title} opacity={titleOpacity} />
      <Captions chunks={chunks} ms={ms} hide={toEnd} />
      <EndFrame opacity={interpolate(f, [endStart + 10, endStart + 30], [0, 1], clamp)} />
      {audio ? (
        <Sequence from={INTRO}>
          <Audio src={staticFile(audio)} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
