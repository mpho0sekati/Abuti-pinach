import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, X, Camera as CameraIcon, Image as ImageIcon, SwitchCamera, Users, Smile } from "lucide-react";
import { startFaceTracking, type FaceUpdate } from "@/utils/faceTracking";

interface CameraCaptureProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
  /** Stream requested directly from the camera button click, so desktop browsers don't block it */
  initialStream?: MediaStream | null;
  /** Error from the direct camera request, if the browser rejected it */
  initialError?: string | null;
  /** Optional: route voice queries to the orb chat pipeline so abuti can converse while camera is on */
  onVoiceQuery?: (transcript: string) => void;
  /** Whether abuti is currently speaking (so we can pause the mic) */
  isSpeaking?: boolean;
  /** Fires when face tracking picks up a face (or loses it) */
  onFaceUpdate?: (u: FaceUpdate) => void;
}

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

type Facing = "user" | "environment";

const EXPRESSION_LABEL: Record<string, string> = {
  neutral: "Neutral",
  happy: "Smiling 😊",
  surprised: "Surprised",
  sad: "Sad",
  angry: "Frowning",
  sleepy: "Sleepy",
};

const CameraCapture = ({ onCapture, onClose, initialStream, initialError, onVoiceQuery, isSpeaking, onFaceUpdate }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceCaption, setVoiceCaption] = useState("");
  const [facing, setFacing] = useState<Facing>("user");
  const [faceInfo, setFaceInfo] = useState<FaceUpdate | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const trackerRef = useRef<{ stop: () => void } | null>(null);
  const initialStreamAttachedRef = useRef<MediaStream | null>(null);

  const handleFileSelect = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      onCapture(base64);
    };
    reader.readAsDataURL(file);
  }, [onCapture]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    trackerRef.current?.stop();
    trackerRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
  }, []);

  const attachStream = useCallback(async (stream: MediaStream, mode: Facing) => {
    if (streamRef.current && streamRef.current !== stream) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    trackerRef.current?.stop();
    trackerRef.current = null;
    streamRef.current = stream;
    setFacing(mode);
    setCamError(null);
    setStarting(true);

    const video = videoRef.current;
    if (!video) {
      setCamError("The camera preview did not mount. Close the lens and try again.");
      setStarting(false);
      return;
    }

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((resolve) => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        resolve();
        return;
      }
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener("loadedmetadata", done);
        video.removeEventListener("canplay", done);
        resolve();
      };
      video.addEventListener("loadedmetadata", done, { once: true });
      video.addEventListener("canplay", done, { once: true });
      window.setTimeout(done, 1800);
    });

    try { await video.play(); } catch {}
    setStreaming(true);
    setStarting(false);

    if (mode === "user") {
      startFaceTracking(video, (e) => console.warn("Face tracking unavailable:", e))
        .then((handle) => { trackerRef.current = handle; });
    }
  }, []);

  const startCamera = useCallback(async (mode: Facing) => {
    stopStream();
    setCamError(null);
    setStreaming(false);
    setStarting(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("Your browser doesn't support camera access. Try Chrome, Edge, or Safari.");
      setStarting(false);
      return;
    }
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      setCamError("Camera needs a secure (HTTPS) connection.");
      setStarting(false);
      return;
    }

    // Try progressively looser constraints — desktops often lack facingMode
    const attempts: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: true, audio: false },
    ];

    let stream: MediaStream | null = null;
    let lastErr: any = null;
    for (const c of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(c);
        break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (!stream) {
      const name = lastErr?.name || "";
      const msg =
        name === "NotAllowedError" || name === "SecurityError"
          ? "Camera access was blocked. Allow camera in your browser's site settings, then retry."
          : name === "NotFoundError" || name === "OverconstrainedError"
          ? "No camera detected on this device."
          : name === "NotReadableError"
          ? "Camera is in use by another app. Close it and retry."
          : "Couldn't start the camera. Try again or upload a photo.";
      setCamError(msg);
      setStarting(false);
      return;
    }

    attachStream(stream, mode);
  }, [attachStream, stopStream]);

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const base64 = dataUrl.split(",")[1];
    setCaptured(dataUrl);
    onCapture(base64);
  }, [onCapture]);

  const stopAll = useCallback(() => {
    stopStream();
    try { recognitionRef.current?.stop(); } catch {}
    setStreaming(false);
    setIsListening(false);
  }, [stopStream]);

  const close = useCallback(() => {
    stopAll();
    onClose();
  }, [onClose, stopAll]);

  const flipCamera = useCallback(() => {
    const next: Facing = facing === "user" ? "environment" : "user";
    setFacing(next);
    setFaceInfo(null);
    startCamera(next);
  }, [facing, startCamera]);

  // Voice listening — talk to abuti while camera is on
  const toggleListen = useCallback(() => {
    if (!onVoiceQuery || !SpeechRecognition) return;
    if (isListening) {
      try { recognitionRef.current?.stop(); } catch {}
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-ZA";
    recognition.onstart = () => { setIsListening(true); setVoiceCaption("Listening…"); };
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript).join(" ");
      setVoiceCaption(transcript);
      if (event.results[event.results.length - 1].isFinal) {
        onVoiceQuery(transcript);
        setVoiceCaption("");
      }
    };
    recognition.onerror = () => { setIsListening(false); setVoiceCaption(""); };
    recognition.onend = () => { setIsListening(false); };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch {}
  }, [onVoiceQuery, isListening]);

  useEffect(() => () => stopAll(), [stopAll]);

  useEffect(() => {
    if (initialError) {
      setCamError(initialError);
      setStarting(false);
    }
  }, [initialError]);

  useEffect(() => {
    if (!initialStream || initialStreamAttachedRef.current === initialStream) return;
    initialStreamAttachedRef.current = initialStream;
    attachStream(initialStream, "user");
  }, [attachStream, initialStream]);

  // Listen for face-update events for local UI badges + parent callback
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<FaceUpdate>).detail;
      setFaceInfo(detail);
      onFaceUpdate?.(detail);
    };
    window.addEventListener("orb:face-update", handler as EventListener);
    return () => window.removeEventListener("orb:face-update", handler as EventListener);
  }, [onFaceUpdate]);

  const mirrored = facing === "user";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: "max(env(safe-area-inset-top), 12px)",
      }}
    >
      {/* Floating panel — leaves the orb visible below/around it */}
      <div
        className="camera-panel"
        style={{
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          width: "min(92vw, 380px)",
          padding: 10,
          borderRadius: 22,
          background: "hsla(140, 22%, 8%, 0.72)",
          backdropFilter: "blur(22px) saturate(140%)",
          WebkitBackdropFilter: "blur(22px) saturate(140%)",
          border: "1px solid hsla(0, 0%, 100%, 0.14)",
          boxShadow: "0 22px 60px hsla(140, 40%, 6%, 0.55), inset 0 0 0 1px hsla(0, 0%, 100%, 0.04)",
        }}
      >
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
      <input ref={galleryInputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />

      {/* Top control bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "4px 6px 2px",
      }}>
        <span style={{ color: "white", fontSize: 12.5, fontFamily: FONT, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, letterSpacing: 0.1 }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: streaming ? "hsl(135, 70%, 55%)" : "hsla(0, 0%, 100%, 0.35)",
            boxShadow: streaming ? "0 0 10px hsl(135, 70%, 55%)" : "none",
          }} />
          <CameraIcon size={13} style={{ opacity: 0.8 }} /> {facing === "user" ? "Abuti sees you" : "Live scan"}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={flipCamera} disabled={!streaming} aria-label="Flip camera" style={{
            width: 30, height: 30, borderRadius: "50%", border: "none",
            background: "hsla(0, 0%, 100%, 0.12)", color: "white",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: streaming ? "pointer" : "not-allowed", opacity: streaming ? 1 : 0.5,
          }}><SwitchCamera size={15} /></button>
          <button onClick={close} aria-label="Close camera" style={{
            width: 30, height: 30, borderRadius: "50%", border: "none",
            background: "hsla(0, 0%, 100%, 0.12)", color: "white",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}><X size={15} /></button>
        </div>
      </div>

      {/* Camera preview */}
      <div style={{
        position: "relative",
        width: "100%",
        aspectRatio: "4 / 3",
        borderRadius: 16,
        overflow: "hidden",
        background: "hsla(0, 0%, 0%, 0.7)",
        border: "1px solid hsla(0, 0%, 100%, 0.08)",
      }}>
        {!camError && (
          <video ref={videoRef}
            style={{
              width: "100%", height: "100%", objectFit: "cover",
              transform: mirrored ? "scaleX(-1)" : "none",
              opacity: streaming ? 1 : 0,
              transition: "opacity 0.2s ease",
            }}
            autoPlay playsInline muted />
        )}
        {captured && (
          <img src={captured} alt="Captured" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}

        {/* Starting shimmer */}
        {starting && !camError && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            color: "hsla(0, 0%, 100%, 0.75)", fontSize: 12, fontFamily: FONT, letterSpacing: 0.3,
          }}>Waking the lens…</div>
        )}

        {!streaming && !starting && !camError && (
          <div style={{
            position: "absolute", inset: 0, padding: 18,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
            textAlign: "center", color: "white", fontFamily: FONT,
            background: "radial-gradient(circle at 50% 35%, hsla(135, 55%, 42%, 0.24), hsla(0, 0%, 0%, 0.56) 62%)",
          }}>
            <CameraIcon size={28} style={{ opacity: 0.88 }} />
            <div style={{ fontSize: 13, lineHeight: 1.4, color: "hsla(0, 0%, 100%, 0.9)" }}>
              Start the live lens so Abuti can lock onto your movement.
            </div>
            <button onClick={() => startCamera("user")} style={{
              padding: "9px 15px", borderRadius: 999, border: "1px solid hsla(0, 0%, 100%, 0.25)",
              background: "hsla(135, 55%, 42%, 0.9)", color: "white", fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: FONT,
            }}>Start live vision</button>
          </div>
        )}

        {/* Error state */}
        {camError && (
          <div style={{
            position: "absolute", inset: 0, padding: 18,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
            textAlign: "center", color: "white", fontFamily: FONT,
          }}>
            <div style={{ fontSize: 13, lineHeight: 1.4, color: "hsla(0, 0%, 100%, 0.9)" }}>{camError}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => startCamera(facing)} style={{
                padding: "8px 14px", borderRadius: 999, border: "1px solid hsla(0, 0%, 100%, 0.25)",
                background: "hsla(135, 55%, 42%, 0.85)", color: "white", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: FONT,
              }}>Retry</button>
              <button onClick={() => galleryInputRef.current?.click()} style={{
                padding: "8px 14px", borderRadius: 999, border: "1px solid hsla(0, 0%, 100%, 0.25)",
                background: "hsla(0, 0%, 100%, 0.1)", color: "white", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: FONT,
              }}>Upload photo</button>
            </div>
          </div>
        )}

        {voiceCaption && (
          <div style={{
            position: "absolute", left: 10, right: 10, bottom: 10,
            padding: "7px 11px", borderRadius: 10,
            background: "hsla(0, 0%, 0%, 0.6)",
            color: "white", fontSize: 12.5, fontFamily: FONT,
            backdropFilter: "blur(10px)",
          }}>{voiceCaption}</div>
        )}

        {facing === "user" && faceInfo && faceInfo.faceCount > 0 && !camError && (
          <div style={{
            position: "absolute", bottom: 10, left: 10,
            display: "flex", gap: 6, flexWrap: "wrap",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 9px", borderRadius: 999,
              background: "hsla(135, 60%, 40%, 0.9)", color: "white",
              fontSize: 10.5, fontFamily: FONT, fontWeight: 600,
            }}>
              <Users size={11} /> {faceInfo.faceCount}{faceInfo.faceCount > 1 && " · closest"}
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 9px", borderRadius: 999,
              background: "hsla(0, 0%, 0%, 0.55)", color: "white",
              fontSize: 10.5, fontFamily: FONT, fontWeight: 600,
            }}>
              <Smile size={11} /> {EXPRESSION_LABEL[faceInfo.expression] || faceInfo.expression}
            </div>
          </div>
        )}

        {isListening && (
          <div style={{
            position: "absolute", top: 10, right: 10,
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 9px", borderRadius: 999,
            background: "hsla(135, 60%, 40%, 0.9)", color: "white",
            fontSize: 10.5, fontFamily: FONT, fontWeight: 600,
            animation: "camPulse 1.4s ease-in-out infinite",
          }}><Mic size={11} /> Listening</div>
        )}
        {isSpeaking && (
          <div style={{
            position: "absolute", top: 10, left: 10,
            padding: "5px 9px", borderRadius: 999,
            background: "hsla(200, 70%, 50%, 0.9)", color: "white",
            fontSize: 10.5, fontFamily: FONT, fontWeight: 600,
          }}>Abuti speaking…</div>
        )}
      </div>

      {/* Action row */}
      <div style={{
        display: "flex", gap: 14, alignItems: "center", justifyContent: "center",
        padding: "6px 10px",
      }}>
        <button onClick={() => galleryInputRef.current?.click()} aria-label="Gallery" style={{
          width: 38, height: 38, borderRadius: "50%", border: "none",
          background: "hsla(0, 0%, 100%, 0.1)", color: "white",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}><ImageIcon size={16} /></button>

        <button onClick={takePhoto} disabled={!streaming} aria-label="Capture" style={{
          width: 56, height: 56, borderRadius: "50%",
          border: "3px solid white",
          background: streaming ? "hsl(135, 45%, 48%)" : "hsla(0, 0%, 100%, 0.18)",
          cursor: streaming ? "pointer" : "not-allowed",
          boxShadow: streaming ? "0 4px 18px hsla(135, 60%, 30%, 0.5)" : "none",
          transition: "transform 0.15s",
        }} />

        {onVoiceQuery && (
          <button onClick={toggleListen} aria-label={isListening ? "Stop listening" : "Talk to Abuti"} style={{
            width: 38, height: 38, borderRadius: "50%", border: "none",
            background: isListening ? "hsl(135, 60%, 45%)" : "hsla(0, 0%, 100%, 0.1)",
            color: "white", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
            boxShadow: isListening ? "0 0 0 5px hsla(135, 60%, 45%, 0.25)" : "none",
          }}>{isListening ? <MicOff size={16} /> : <Mic size={16} />}</button>
        )}
      </div>

      <p style={{
        color: "hsla(0, 0%, 100%, 0.65)", fontSize: 11, fontFamily: FONT,
        margin: "0 4px 2px", textAlign: "center", lineHeight: 1.35,
      }}>
        {camError
          ? "Fix the issue above to bring Abuti's vision online."
          : facing === "user"
          ? "Abuti's eyes follow you — smile, frown, or move around"
          : (onVoiceQuery ? "Tap the mic to ask Abuti about what you see" : "Point at a leaf, pest, or soil patch")}
      </p>

      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <style>{`
        @keyframes camPulse {
          0%, 100% { box-shadow: 0 0 0 0 hsla(135, 60%, 45%, 0.5); }
          50% { box-shadow: 0 0 0 10px hsla(135, 60%, 45%, 0); }
        }
        @media (min-width: 768px) {
          .camera-panel {
            position: fixed;
            top: 16px;
            right: 16px;
            width: 340px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CameraCapture;
