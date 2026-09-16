/**
 * restrictedGestureDetector.js
 *
 * Immediate safety: as soon as one high-confidence restricted frame is seen,
 * trigger camera off. No multi-frame / time hold.
 */

import {
  RESTRICTED_CONFIDENCE_THRESHOLD,
  RESTRICTED_CONFIRM_FRAMES,
  RESTRICTED_GESTURES,
} from "./config.js";

export function createRestrictedGestureDetector({
  restrictedList = RESTRICTED_GESTURES,
  confirmFrames = RESTRICTED_CONFIRM_FRAMES,
  confidenceThreshold = RESTRICTED_CONFIDENCE_THRESHOLD,
} = {}) {
  let streak = 0;
  let lastGesture = null;

  return {
    /**
     * @returns {{ triggered: boolean, gesture: string|null, holdProgress: number, streak: number }}
     */
    update(gesture, confidence) {
      const isRestricted =
        restrictedList.includes(gesture) && confidence >= confidenceThreshold;

      if (!isRestricted) {
        streak = 0;
        lastGesture = null;
        return { triggered: false, gesture: null, holdProgress: 0, streak: 0 };
      }

      // Same clear gesture → count; first hit with confirmFrames=1 fires now
      if (lastGesture === gesture) {
        streak += 1;
      } else {
        lastGesture = gesture;
        streak = 1;
      }

      const holdProgress = Math.min(1, streak / Math.max(1, confirmFrames));

      if (streak >= confirmFrames) {
        streak = 0;
        lastGesture = null;
        return { triggered: true, gesture, holdProgress: 1, streak: confirmFrames };
      }

      return { triggered: false, gesture, holdProgress, streak };
    },

    reset() {
      streak = 0;
      lastGesture = null;
    },
  };
}
