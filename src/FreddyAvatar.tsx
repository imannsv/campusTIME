import { Blobatar } from "@blobatar/react";
import { useGaze } from "@blobatar/react/gaze";
import { idle, thinking } from "blobatar/expression";
import "blobatar/motion.css";
import "blobatar/gaze.css";

export default function FreddyAvatar({
  size,
  busy = false,
  active = true,
  decorative = false,
}: {
  size: number;
  busy?: boolean;
  active?: boolean;
  decorative?: boolean;
}) {
  const { ref } = useGaze({ travel: 4, lookAt: active ? "pointer" : null });
  return (
    <Blobatar
      ref={ref}
      name="Freddy"
      size={size}
      palette={{ head: "#6ed8bf", eye: "#173b50" }}
      traits={{
        shape: 0.12,
        "body.r": 0.92,
        "body.n": 0.18,
        "body.ratio": 0.5,
        "body.x": 0.5,
        "body.y": 0.5,
        "eye.rx": 0.95,
        "eye.ratio": 0.18,
        "eye.scale": 0.48,
        "eye.stretch": 0.45,
        "eye.gap": 0.55,
        "eye.dy": 0.5,
        "eye.lean": 0.5,
        "eye.lean2": 0.5,
        "gaze.x": 0.5,
        "gaze.y": 0.55,
      }}
      animate="always"
      expression={busy ? thinking : idle}
      title={decorative ? undefined : "Freddy – Blobatar"}
      aria-hidden={decorative ? true : undefined}
      className="freddy-avatar"
    />
  );
}
