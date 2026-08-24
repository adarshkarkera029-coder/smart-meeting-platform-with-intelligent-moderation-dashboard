import React from "react";

const BAR_COUNT = 7;

export default function Waveform({ level = 0, active = false }) {
  return (
    <div className={`waveform ${active ? "is-active" : ""}`} aria-hidden="true">
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const offset = 1 - Math.abs(i - (BAR_COUNT - 1) / 2) / BAR_COUNT;
        const height = active ? Math.max(4, level * 18 * offset + 3) : 3;
        return (
          <div
            key={i}
            className="waveform-bar"
            style={{
              height: `${height}px`,
              animationDelay: `${i * 80}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
