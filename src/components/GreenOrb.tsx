import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { WeatherAlertLevel } from "@/components/OrbController";

export type Emotion = "neutral" | "curious" | "happy" | "laughing" | "sleepy" | "sleeping" | "thinking" | "speaking" | "listening" | "worried" | "excited" | "eyebrow-raise";

const IDLE_TIMEOUT = 8000;
const SLEEP_TIMEOUT = 15000;

interface GreenOrbProps {
  emotion?: Emotion;
  label?: string;
  onTap?: () => void;
  isSpeaking?: boolean;
  weatherAlert?: WeatherAlertLevel;
}

const GreenOrb = ({ emotion: externalEmotion, label, onTap, isSpeaking: isSpeakingProp, weatherAlert = "none" }: GreenOrbProps) => {
  const orbRef = useRef<HTMLDivElement>(null);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [isWinking, setIsWinking] = useState<"none" | "left" | "right">("none");
  const [isPressed, setIsPressed] = useState(false);
  const [internalEmotion, setInternalEmotion] = useState<Emotion>("neutral");
  const [breathPhase, setBreathPhase] = useState(0);
  const [squishX, setSquishX] = useState(1);
  const [squishY, setSquishY] = useState(1);
  const lastActivityRef = useRef(Date.now());
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const emotion = externalEmotion || internalEmotion;

  const vibrate = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate([15, 10, 30]);
  }, []);

  const wakeUp = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (!externalEmotion) {
      setInternalEmotion((prev) => {
        if (prev === "sleeping" || prev === "sleepy") return "happy";
        return prev;
      });
    }
  }, [externalEmotion]);

  const gazeUntilRef = useRef(0);

  const updateEyePosition = useCallback(
    (clientX: number, clientY: number, source: "mouse" | "gaze" = "mouse") => {
      if (!orbRef.current) return;
      // While the camera is actively feeding gaze coords, ignore mouse — the orb should follow the person, not the cursor.
      if (source === "mouse" && Date.now() < gazeUntilRef.current) return;
      wakeUp();
      const rect = orbRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Boost amplitude when tracking a face so the eye motion is clearly visible on desktop.
      const maxOffset = source === "gaze" ? 18 : 10;
      const factor = source === "gaze" ? Math.min(dist / 95, 1) : Math.min(dist / 180, 1);
      setEyeOffset({
        x: (dx / (dist || 1)) * maxOffset * factor,
        y: (dy / (dist || 1)) * maxOffset * factor,
      });
    },
    [wakeUp]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => updateEyePosition(e.clientX, e.clientY, "mouse");
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) updateEyePosition(touch.clientX, touch.clientY, "mouse");
    };
    // When the camera tracks a face, the orb's eyes should follow it too and outrank the cursor
    const handleGaze = (e: Event) => {
      const detail = (e as CustomEvent<{ x: number; y: number }>).detail;
      if (detail) {
        gazeUntilRef.current = Date.now() + 1200; // suppress mouse override briefly after each gaze frame
        updateEyePosition(detail.x, detail.y, "gaze");
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("orb:gaze", handleGaze as EventListener);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("orb:gaze", handleGaze as EventListener);
    };
  }, [updateEyePosition]);

  // Organic breathing
  useEffect(() => {
    const interval = setInterval(() => setBreathPhase(p => (p + 1) % 360), 40);
    return () => clearInterval(interval);
  }, []);

  // Random winking
  useEffect(() => {
    if (emotion === "sleeping") return;
    if (!["neutral", "thinking", "happy", "curious"].includes(emotion)) return;
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setIsWinking(Math.random() > 0.5 ? "left" : "right");
        setTimeout(() => setIsWinking("none"), 180 + Math.random() * 120);
      }
    }, 4000 + Math.random() * 7000);
    return () => clearInterval(interval);
  }, [emotion]);

  // Idle/sleep
  useEffect(() => {
    if (externalEmotion) return;
    idleTimerRef.current = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle > SLEEP_TIMEOUT) {
        setInternalEmotion("sleeping");
        setEyeOffset({ x: 0, y: 2 });
      } else if (idle > IDLE_TIMEOUT) {
        setInternalEmotion("sleepy");
      }
    }, 1000);
    return () => clearInterval(idleTimerRef.current);
  }, [externalEmotion]);

  // Natural double-blink
  useEffect(() => {
    if (emotion === "sleeping") return;
    const baseInterval = emotion === "sleepy" ? 1500 : emotion === "curious" ? 4500 : 3200;
    const blink = () => { setIsBlinking(true); setTimeout(() => setIsBlinking(false), 100); };
    const interval = setInterval(() => {
      blink();
      if (Math.random() > 0.65) setTimeout(blink, 250);
    }, baseInterval + Math.random() * 2000);
    return () => clearInterval(interval);
  }, [emotion]);

  const handleOrbTouch = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.stopPropagation();
      const point = "touches" in e
        ? (e as React.TouchEvent).touches[0] || (e as React.TouchEvent).changedTouches[0]
        : (e as React.MouseEvent);
      if (point) updateEyePosition(point.clientX, point.clientY);
      onTap?.();
      // Jelly squish effect
      setSquishX(1.08);
      setSquishY(0.92);
      setIsPressed(true);
      vibrate();
      setTimeout(() => { setSquishX(0.95); setSquishY(1.05); }, 120);
      setTimeout(() => { setSquishX(1.02); setSquishY(0.98); }, 240);
      setTimeout(() => { setSquishX(1); setSquishY(1); setIsPressed(false); }, 360);
    },
    [updateEyePosition, vibrate, onTap]
  );

  const isSleeping = emotion === "sleeping";
  const isSleepy = emotion === "sleepy";
  const isThinking = emotion === "thinking";
  const isListening = emotion === "listening";
  const isSpeaking = emotion === "speaking" || isSpeakingProp;
  const isExcited = emotion === "excited";
  const isWorried = emotion === "worried";
  const isHappy = emotion === "happy";

  // --- Eye rendering ---
  const getEyeShape = (side: "left" | "right") => {
    const isWinkingSide = isWinking === side;

    // Defaults: medium glowing pill — no pupils, pure glowing yellow
    let w = 20, h = 34, br = "10px", rot = 0, ty = 0, opacity = 1;

    if (isSleeping) { h = 4; br = "4px"; }
    else if (isSleepy) { h = isBlinking ? 4 : 16; br = "7px"; }
    else if (isBlinking) { h = 4; br = "5px"; }
    else if (isWinkingSide) { h = 5; br = "5px"; }
    else if (isHappy) { w = 24; h = 14; br = "12px 12px 4px 4px"; }
    else if (isSpeaking) { w = 22; h = 32; br = "11px"; }
    else if (isListening) { w = 24; h = 38; br = "12px"; }
    else if (emotion === "curious") { w = 26; h = 38; br = "13px"; }
    else if (isThinking) {
      // Proper thinking face: left eye squints slightly, right eye looks up skeptically
      if (side === "left") { w = 22; h = 20; br = "11px 11px 8px 8px"; ty = 2; rot = -4; }
      else { w = 18; h = 28; br = "9px 9px 10px 10px"; ty = -4; rot = 3; }
    }
    else if (isWorried) {
      rot = side === "left" ? 8 : -8;
      w = 18; h = 32; br = "9px";
    }
    else if (isExcited) { w = 26; h = 36; br = "13px"; }
    else if (emotion === "eyebrow-raise") {
      if (side === "left") { w = 24; h = 38; ty = -4; }
      else { w = 16; h = 26; ty = 4; }
      br = "12px";
    }

    return { w, h, br, rot, ty, opacity };
  };

  const eyeGap = isExcited || emotion === "curious" ? 30 : isHappy ? 28 : 26;

  const renderEye = (side: "left" | "right") => {
    const s = getEyeShape(side);
    const isClosed = s.h <= 5;

    return (
      <div key={side} style={{
        width: s.w,
        height: s.h,
        borderRadius: s.br,
        transform: `rotate(${s.rot}deg) translateY(${s.ty}px)`,
        transition: "all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)",
        position: "relative",
        overflow: "hidden",
        background: isClosed
          ? "hsla(48, 85%, 75%, 0.95)"
          : "linear-gradient(175deg, hsl(52, 100%, 88%) 0%, hsl(48, 95%, 75%) 40%, hsl(44, 90%, 65%) 100%)",
        boxShadow: isClosed
          ? "0 0 8px hsla(48, 75%, 68%, 0.5)"
          : `0 0 20px hsla(48, 85%, 68%, 0.7),
             0 0 40px hsla(48, 75%, 62%, 0.25),
             0 0 60px hsla(48, 65%, 55%, 0.1),
             inset 0 2px 6px hsla(52, 100%, 92%, 0.7),
             inset 0 -2px 4px hsla(42, 75%, 50%, 0.12)`,
      }}>
        {!isClosed && (
          <>
            {/* Inner luminosity */}
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(ellipse at 50% 30%, hsla(52, 100%, 95%, 0.6), transparent 65%)",
            }} />
            {/* Glint - top right sparkle */}
            <div style={{
              position: "absolute",
              width: 5, height: 5,
              borderRadius: "50%",
              background: "hsl(0, 0%, 100%)",
              top: "16%", right: "18%",
              boxShadow: "0 0 8px hsla(0, 0%, 100%, 1)",
            }} />
            {/* Secondary glint */}
            <div style={{
              position: "absolute",
              width: 2.5, height: 2.5,
              borderRadius: "50%",
              background: "hsla(0, 0%, 100%, 0.7)",
              bottom: "22%", left: "18%",
              boxShadow: "0 0 4px hsla(0, 0%, 100%, 0.5)",
            }} />
          </>
        )}
      </div>
    );
  };

  // --- Body ---
  const bodyGradient = useMemo(() => {
    const hueShift = isSleeping || isSleepy ? 5 : isThinking ? 10 : isSpeaking ? -5 : isExcited ? -10 : isHappy ? -3 : 0;
    const satBoost = isExcited ? 8 : isSpeaking ? 5 : isHappy ? 3 : 0;
    const lightBoost = isSleeping ? -5 : isSleepy ? -3 : isExcited ? 4 : 0;
    
    const h1 = 128 + hueShift, s1 = 48 + satBoost, l1 = 58 + lightBoost;
    const h2 = 140 + hueShift, s2 = 44 + satBoost, l2 = 46 + lightBoost;
    const h3 = 155 + hueShift, s3 = 38 + satBoost, l3 = 32 + lightBoost;

    return `
      radial-gradient(circle at 35% 25%, 
        hsl(${h1}, ${s1}%, ${l1}%) 0%, 
        hsl(${h2}, ${s2}%, ${l2}%) 55%, 
        hsl(${h3}, ${s3}%, ${l3}%) 100%)
    `;
  }, [isSleeping, isSleepy, isThinking, isSpeaking, isExcited, isHappy]);

  const ORB_SIZE = 170;
  const breathScale = 1 + Math.sin(breathPhase * Math.PI / 180) * 0.012;
  const breathY = Math.sin(breathPhase * Math.PI / 180) * 1.5;

  const getAnimation = () => {
    if (isThinking) return "orbThink 3.5s ease-in-out infinite";
    if (isSpeaking) return "orbSpeak 1.4s ease-in-out infinite";
    if (isListening) return "orbListen 2.8s ease-in-out infinite";
    if (isExcited) return "orbBounce 0.8s ease-in-out infinite";
    return undefined;
  };

  // Highlight position subtly shifts based on eye offset (parallax)
  const highlightX = 18 + eyeOffset.x * 0.3;
  const highlightY = 10 + eyeOffset.y * 0.2;

  return (
    <div className="flex flex-col items-center gap-4 touch-none">
      <div
        ref={orbRef}
        className="relative cursor-default"
        onTouchStart={handleOrbTouch}
        onClick={handleOrbTouch as any}
        style={{
          width: ORB_SIZE,
          height: ORB_SIZE,
          transform: `translateY(${breathY}px) scaleX(${squishX * breathScale}) scaleY(${squishY * breathScale})`,
          transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
          animation: getAnimation(),
        }}
      >
        {/* Sleeping Z's */}
        {isSleeping && (
          <>
            <span className="absolute" style={{ top: -12, right: 12, fontSize: 16, fontWeight: 800, color: "hsl(130, 30%, 60%)", opacity: 0.5, animation: "floatZ 2.5s ease-in-out infinite", fontFamily: "system-ui" }}>Z</span>
            <span className="absolute" style={{ top: -26, right: 0, fontSize: 12, fontWeight: 800, color: "hsl(130, 30%, 65%)", opacity: 0.35, animation: "floatZ 2.5s ease-in-out 0.5s infinite", fontFamily: "system-ui" }}>z</span>
            <span className="absolute" style={{ top: -36, right: -12, fontSize: 9, fontWeight: 800, color: "hsl(130, 30%, 70%)", opacity: 0.25, animation: "floatZ 2.5s ease-in-out 1s infinite", fontFamily: "system-ui" }}>z</span>
          </>
        )}

        {/* Listening pulse rings */}
        {isListening && (
          <>
            <div className="absolute inset-0 rounded-full" style={{ border: "1px solid hsla(130, 50%, 60%, 0.2)", animation: "ringPulse 2s ease-out infinite" }} />
            <div className="absolute inset-0 rounded-full" style={{ border: "1px solid hsla(130, 50%, 60%, 0.12)", animation: "ringPulse 2s ease-out 0.7s infinite" }} />
          </>
        )}

        {/* Weather alert pulse rings */}
        {weatherAlert !== "none" && (
          <>
            <div className="absolute inset-0 rounded-full" style={{
              border: `2px solid ${weatherAlert === "severe" ? "hsla(0, 70%, 55%, 0.4)" : "hsla(30, 80%, 55%, 0.35)"}`,
              animation: `alertPulse ${weatherAlert === "severe" ? "0.8s" : "1.4s"} ease-out infinite`,
            }} />
            <div className="absolute inset-0 rounded-full" style={{
              border: `1.5px solid ${weatherAlert === "severe" ? "hsla(0, 70%, 55%, 0.25)" : "hsla(30, 80%, 55%, 0.2)"}`,
              animation: `alertPulse ${weatherAlert === "severe" ? "0.8s" : "1.4s"} ease-out 0.4s infinite`,
            }} />
            {weatherAlert === "severe" && (
              <div className="absolute inset-0 rounded-full" style={{
                border: "1px solid hsla(0, 70%, 55%, 0.15)",
                animation: "alertPulse 0.8s ease-out 0.6s infinite",
              }} />
            )}
          </>
        )}

        {/* Soft outer glow — the "soul light" */}
        <div className="absolute rounded-full" style={{
          inset: -20,
          background: weatherAlert === "severe"
            ? `radial-gradient(circle, hsla(0, 65%, 50%, 0.3) 20%, hsla(0, 50%, 40%, 0.05) 55%, transparent 70%)`
            : weatherAlert === "moderate"
            ? `radial-gradient(circle, hsla(30, 70%, 50%, 0.25) 20%, hsla(30, 50%, 40%, 0.04) 55%, transparent 70%)`
            : `radial-gradient(circle,
            hsla(130, 50%, 55%, ${isSpeaking ? 0.2 : isExcited ? 0.25 : isListening ? 0.15 : 0.08}) 20%,
            hsla(130, 45%, 50%, 0.02) 55%,
            transparent 70%)`,
          filter: "blur(20px)",
          transition: "all 1s ease",
          animation: weatherAlert === "severe" ? "alertGlow 0.8s ease-in-out infinite"
            : weatherAlert === "moderate" ? "alertGlow 1.4s ease-in-out infinite"
            : isSpeaking ? "glowPulse 1.4s ease-in-out infinite"
            : isListening ? "glowPulse 2.8s ease-in-out infinite" : "none",
        }} />

        {/* Drop shadow on "ground" */}
        <div className="absolute" style={{
          bottom: -10, left: "15%", right: "15%", height: 16,
          background: "radial-gradient(ellipse, hsla(140, 25%, 30%, 0.12), transparent 70%)",
          filter: "blur(10px)",
          borderRadius: "50%",
        }} />

        {/* Main sphere body — multi-layer for depth */}
        <div className="absolute inset-0 rounded-full" style={{
          background: bodyGradient,
          boxShadow: `
            inset -8px -10px 24px hsla(155, 35%, 18%, 0.3),
            inset 6px 8px 20px hsla(115, 50%, 72%, 0.25),
            inset 0 0 40px hsla(130, 40%, 50%, 0.08),
            0 12px 40px hsla(140, 30%, 30%, 0.15),
            0 4px 12px hsla(140, 25%, 25%, 0.1)
          `,
          transition: "background 1s ease, box-shadow 1s ease",
        }} />

        {/* Liquid Glass: frosted inner refraction layer */}
        <div className="absolute inset-0 rounded-full" style={{
          background: `
            radial-gradient(ellipse at 30% 20%, hsla(0, 0%, 100%, 0.22) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 80%, hsla(130, 40%, 90%, 0.1) 0%, transparent 40%),
            linear-gradient(160deg, hsla(0, 0%, 100%, 0.12) 0%, transparent 40%, hsla(130, 30%, 60%, 0.06) 100%)
          `,
          backdropFilter: "blur(2px) saturate(1.4)",
          WebkitBackdropFilter: "blur(2px) saturate(1.4)",
          transition: "all 1s ease",
        }} />

        {/* Subsurface scattering layer — the premium "glow from within" */}
        <div className="absolute inset-0 rounded-full" style={{
          background: `radial-gradient(circle at 50% 60%,
            hsla(120, 45%, 60%, 0.12) 0%,
            transparent 50%)`,
          transition: "all 1s ease",
        }} />

        {/* Liquid Glass: primary specular — broad, diffused, parallax-reactive */}
        <div className="absolute rounded-full" style={{
          width: "58%", height: "36%",
          top: `${highlightY - 2}%`,
          left: `${highlightX - 2}%`,
          background: `radial-gradient(ellipse at 50% 45%,
            hsla(0, 0%, 100%, ${isSleeping ? 0.18 : 0.45}) 0%,
            hsla(0, 0%, 100%, ${isSleeping ? 0.06 : 0.18}) 40%,
            hsla(0, 0%, 100%, 0.04) 70%,
            transparent 100%)`,
          filter: "blur(4px)",
          transform: "rotate(-12deg)",
          transition: "all 0.8s ease",
        }} />

        {/* Liquid Glass: thin crisp specular line — Apple-style glint */}
        <div className="absolute rounded-full" style={{
          width: "36%", height: "8%",
          top: `${highlightY + 2}%`,
          left: `${highlightX + 6}%`,
          background: `linear-gradient(90deg,
            transparent 0%,
            hsla(0, 0%, 100%, ${isSleeping ? 0.1 : 0.55}) 30%,
            hsla(0, 0%, 100%, ${isSleeping ? 0.1 : 0.6}) 50%,
            hsla(0, 0%, 100%, ${isSleeping ? 0.1 : 0.45}) 70%,
            transparent 100%)`,
          filter: "blur(1.5px)",
          transform: "rotate(-8deg)",
          transition: "all 0.8s ease",
          borderRadius: 100,
        }} />

        {/* Secondary edge highlight — bottom right caustic */}
        <div className="absolute rounded-full" style={{
          width: 28, height: 14,
          bottom: "12%", right: "10%",
          background: "radial-gradient(ellipse, hsla(0, 0%, 100%, 0.2), hsla(130, 40%, 80%, 0.08), transparent)",
          filter: "blur(5px)",
          transform: "rotate(25deg)",
        }} />

        {/* Liquid Glass: rim refraction — prismatic edge catch */}
        <div className="absolute inset-0 rounded-full" style={{
          background: `linear-gradient(135deg, 
            transparent 35%, 
            hsla(180, 40%, 85%, 0.1) 48%,
            hsla(120, 40%, 75%, 0.12) 55%, 
            hsla(90, 50%, 80%, 0.1) 62%, 
            transparent 75%)`,
        }} />

        {/* Liquid Glass: bottom refraction band */}
        <div className="absolute inset-0 rounded-full" style={{
          background: `linear-gradient(0deg, 
            hsla(130, 30%, 70%, 0.08) 0%,
            hsla(0, 0%, 100%, 0.04) 15%,
            transparent 30%)`,
        }} />

        {/* Thinking eyebrows — furrowed asymmetric brows */}
        {isThinking && (
          <>
            {/* Left eyebrow — lower, furrowed */}
            <div className="absolute" style={{
              top: "35%", left: "28%",
              width: 18, height: 3,
              borderRadius: 2,
              background: "linear-gradient(90deg, hsla(48, 70%, 65%, 0.7), hsla(48, 60%, 55%, 0.4))",
              transform: "rotate(12deg)",
              boxShadow: "0 0 6px hsla(48, 70%, 60%, 0.3)",
              transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
              animation: "eyebrowFurrow 3.5s ease-in-out infinite",
            }} />
            {/* Right eyebrow — raised, skeptical */}
            <div className="absolute" style={{
              top: "30%", right: "27%",
              width: 16, height: 2.5,
              borderRadius: 2,
              background: "linear-gradient(90deg, hsla(48, 60%, 55%, 0.4), hsla(48, 70%, 65%, 0.7))",
              transform: "rotate(-6deg)",
              boxShadow: "0 0 6px hsla(48, 70%, 60%, 0.3)",
              transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
              animation: "eyebrowRaise 3.5s ease-in-out infinite",
            }} />
          </>
        )}

        {/* Eyes */}
        <div data-orb-eyes className="absolute flex items-center justify-center" style={{
          top: "47%",
          left: "50%",
          gap: eyeGap,
          transform: `translate(-50%, -50%) translate(${isThinking ? eyeOffset.x * 0.5 - 3 : eyeOffset.x}px, ${isThinking ? eyeOffset.y * 0.5 - 2 : eyeOffset.y}px)`,
          transition: "gap 0.3s ease, transform 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}>
          {renderEye("left")}
          {renderEye("right")}
        </div>
      </div>

      {/* Label */}
      {label && (
        <span style={{
          fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase",
          color: "hsl(130, 15%, 55%)",
          fontFamily: "'SF Pro Text', -apple-system, system-ui, sans-serif",
          opacity: 0.5,
        }}>
          {label}
        </span>
      )}

      <style>{`
        @keyframes floatZ {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.5; }
          50% { transform: translateY(-14px) translateX(6px); opacity: 0.1; }
        }
        @keyframes orbThink {
          0% { transform: translateY(0) rotate(-1deg) scale(1); }
          15% { transform: translateY(-3px) rotate(-2.5deg) scale(1.008); }
          30% { transform: translateY(-1px) rotate(-1.5deg) scale(1.004); }
          50% { transform: translateY(1px) rotate(-3deg) scale(0.996); }
          70% { transform: translateY(-2px) rotate(-0.5deg) scale(1.006); }
          85% { transform: translateY(0px) rotate(-2deg) scale(1.002); }
          100% { transform: translateY(0) rotate(-1deg) scale(1); }
        }
        @keyframes orbSpeak {
          0%, 100% { transform: scale(1); }
          15% { transform: scale(1.02); }
          35% { transform: scale(0.985); }
          55% { transform: scale(1.025); }
          75% { transform: scale(0.99); }
        }
        @keyframes orbListen {
          0%, 100% { transform: scale(1) translateY(0); }
          30% { transform: scale(1.02) translateY(-1px); }
          60% { transform: scale(1.015) translateY(0.5px); }
        }
        @keyframes orbBounce {
          0%, 100% { transform: scale(1) translateY(0); }
          25% { transform: scale(1.04) translateY(-4px); }
          50% { transform: scale(0.97) translateY(1px); }
          75% { transform: scale(1.02) translateY(-2px); }
        }
        @keyframes ringPulse {
          0% { transform: scale(1); opacity: 0.3; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes alertPulse {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes alertGlow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.15); }
        }
        @keyframes eyebrowFurrow {
          0%, 100% { transform: rotate(12deg) translateY(0); }
          30% { transform: rotate(15deg) translateY(1px); }
          60% { transform: rotate(10deg) translateY(-0.5px); }
        }
        @keyframes eyebrowRaise {
          0%, 100% { transform: rotate(-6deg) translateY(0); }
          30% { transform: rotate(-8deg) translateY(-2px); }
          60% { transform: rotate(-4deg) translateY(0.5px); }
        }
      `}</style>
    </div>
  );
};

export default GreenOrb;
