/**
 * safetyCameraController.js
 *
 * Turns the local WebRTC camera off via the existing track.enabled path.
 * Does not create a second getUserMedia — only toggles the meeting stream.
 * Includes cooldown so one detection cannot spam on/off.
 */

import { SAFETY_COOLDOWN_MS } from "./config.js";

/**
 * @param {object} opts
 * @param {() => MediaStream|null} opts.getStream - current local MediaStream
 * @param {(on: boolean) => void} opts.setCamOn - React setState for camOn
 * @param {() => boolean} opts.getCamOn - current camOn
 * @param {(event: { type: string, at: number, gesture?: string }) => void} [opts.onLog]
 * @param {number} [opts.cooldownMs]
 */
export function createSafetyCameraController({
  getStream,
  setCamOn,
  getCamOn,
  onLog,
  cooldownMs = SAFETY_COOLDOWN_MS,
} = {}) {
  let lastTriggerAt = 0;
  let lastReason = null;

  function log(type, extra = {}) {
    const event = { type, at: Date.now(), ...extra };
    // Privacy: event type + time only — never frames
    console.info("[gesture-safety]", event);
    onLog?.(event);
  }

  return {
    /** @returns {boolean} true if camera was turned off */
    disableCameraForRestrictedGesture(gesture) {
      const now = Date.now();
      if (now - lastTriggerAt < cooldownMs) {
        return false;
      }
      if (!getCamOn()) {
        return false;
      }

      const stream = getStream?.();
      if (stream) {
        stream.getVideoTracks().forEach((t) => {
          t.enabled = false;
        });
      }

      lastTriggerAt = now;
      lastReason = gesture || "restricted";
      setCamOn(false);
      log("camera_disabled_restricted_gesture", { gesture: lastReason });
      return true;
    },

    /** User manually re-enables camera (respects cooldown only for auto-disable). */
    enableCamera() {
      const stream = getStream?.();
      if (stream) {
        stream.getVideoTracks().forEach((t) => {
          t.enabled = true;
        });
      }
      setCamOn(true);
      log("camera_reenabled_by_user");
    },

    canAutoDisable() {
      return Date.now() - lastTriggerAt >= cooldownMs;
    },

    getLastReason() {
      return lastReason;
    },

    resetCooldown() {
      lastTriggerAt = 0;
    },
  };
}
