import { useEffect, useRef, useState } from "react";
import { useVAD } from "./useVAD.js";

const RECORDER_MIME = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
  ? "audio/webm;codecs=opus"
  : "audio/webm";

/** Discard blobs smaller than this — usually clicks / chair noise */
const MIN_BLOB_BYTES = 2800;
/** Don't send if utterance was marked too short by VAD */
const MIN_DURATION_MS = 280;

/**
 * Drives the AI dashboard pipeline: VAD decides when someone is speaking,
 * MediaRecorder captures that utterance, and the segment is sent to the
 * backend for transcription → condensation → summary.
 */
export function useAudioPipeline({ socket, roomId, name, stream, listening }) {
  const [pipelineError, setPipelineError] = useState(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);

  const handleSpeechStart = () => {
    if (!listening || !stream) return;
    socket.current?.emit("speaking:start");
    socket.current?.emit("speech:start");

    try {
      const audioOnly = new MediaStream(stream.getAudioTracks());
      const recorder = new MediaRecorder(audioOnly, {
        mimeType: RECORDER_MIME,
        audioBitsPerSecond: 128000,
      });
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      // timeslice keeps data flowing if stop is delayed
      recorder.start(250);
      recorderRef.current = recorder;
    } catch (err) {
      setPipelineError(`Recorder error: ${err.message}`);
    }
  };

  const handleSpeechEnd = (meta = {}) => {
    socket.current?.emit("speaking:stop");
    socket.current?.emit("speech:end");

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    const tooShort = meta.tooShort || (Date.now() - startedAtRef.current) < MIN_DURATION_MS;

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: RECORDER_MIME });
      chunksRef.current = [];
      recorderRef.current = null;

      if (tooShort || blob.size < MIN_BLOB_BYTES) {
        return; // noise / accidental trigger
      }

      const arrayBuffer = await blob.arrayBuffer();
      socket.current?.emit(
        "audio:chunk",
        {
          roomId,
          name,
          mimeType: RECORDER_MIME,
          audio: arrayBuffer,
        },
        (ack) => {
          if (ack && ack.ok === false) {
            setPipelineError(ack.error || "Pipeline error");
          }
        }
      );
    };
    try {
      recorder.stop();
    } catch {
      /* already stopped */
    }
  };

  const { isSpeaking, level } = useVAD(stream, {
    enabled: listening,
    onSpeechStart: handleSpeechStart,
    onSpeechEnd: handleSpeechEnd,
  });

  useEffect(() => {
    if (!socket.current) return;
    const s = socket.current;
    const onErr = (err) => setPipelineError(`${err.stage}: ${err.message}`);
    s.on("pipeline:error", onErr);
    return () => s.off("pipeline:error", onErr);
  }, [socket]);

  useEffect(() => {
    if (!listening && recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
  }, [listening]);

  return { isSpeaking, level, pipelineError };
}
