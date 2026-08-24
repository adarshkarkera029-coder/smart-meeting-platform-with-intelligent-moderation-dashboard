import React, { useEffect, useRef } from "react";
import webGLFluidEnhanced from "webgl-fluid";

export default function FluidCursor() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let onMove = null;
    let onDown = null;
    const nativeAdd = canvas.addEventListener.bind(canvas);
    canvas.addEventListener = (type, fn, opts) => {
      if (type === "mousemove") onMove = fn;
      if (type === "mousedown") onDown = fn;
      return nativeAdd(type, fn, opts);
    };

    webGLFluidEnhanced(canvas, {
      TRIGGER: "hover",
      IMMEDIATE: true,
      AUTO: false,
      SIM_RESOLUTION: 128,
      DYE_RESOLUTION: 512,
      DENSITY_DISSIPATION: 1.4,
      VELOCITY_DISSIPATION: 1.1,
      PRESSURE: 0.12,
      PRESSURE_ITERATIONS: 20,
      CURL: 6,
      SPLAT_RADIUS: 0.28,
      SPLAT_FORCE: 9000,
      SHADING: true,
      COLORFUL: true,
      COLOR_UPDATE_SPEED: 8,
      PAUSED: false,
      BACK_COLOR: { r: 0, g: 0, b: 0 },
      TRANSPARENT: true,
      BLOOM: true,
      BLOOM_ITERATIONS: 8,
      BLOOM_RESOLUTION: 256,
      BLOOM_INTENSITY: 0.7,
      BLOOM_THRESHOLD: 0.5,
      BLOOM_SOFT_KNEE: 0.7,
      SUNRAYS: true,
      SUNRAYS_RESOLUTION: 196,
      SUNRAYS_WEIGHT: 0.8,
    });

    const restoreTimer = window.setTimeout(() => {
      canvas.addEventListener = nativeAdd;
    }, 800);

    const point = (e) => {
      const rect = canvas.getBoundingClientRect();
      const source = e.touches?.[0] || e;
      return {
        offsetX: source.clientX - rect.left,
        offsetY: source.clientY - rect.top,
      };
    };

    const overIgnored = (e) => {
      const node = e.target;
      return !!(node && node.closest && node.closest("[data-fluid-ignore]"));
    };

    const onPointerMove = (e) => {
      if (overIgnored(e) || !onMove) return;
      onMove(point(e));
    };
    const onPointerDown = (e) => {
      if (overIgnored(e)) return;
      const p = point(e);
      if (onDown) onDown(p);
      if (onMove) onMove(p);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("touchmove", onPointerMove, { passive: true });

    return () => {
      window.clearTimeout(restoreTimer);
      canvas.addEventListener = nativeAdd;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("touchmove", onPointerMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="fluid-cursor" aria-hidden="true" />;
}
