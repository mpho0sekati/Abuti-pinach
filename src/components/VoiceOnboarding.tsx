import { useState, useCallback, useEffect, useRef } from "react";
import { createUtterance, cleanForTTS } from "@/utils/tts";
import { Leaf, User, Mic, Camera, Wifi, Rocket, Trophy, TrendingUp } from "lucide-react";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

type OnboardingStage =
  | "greeting"
  | "waiting-answer"
  | "tour-intro"
  | "tour-voice"
  | "tour-camera"
  | "tour-offline"
  | "tour-agent"
  | "tour-done"
  | "returning"
  | "complete";

const TOUR_SCRIPTS: Record<string, { text: string; icon: keyof typeof STAGE_ICONS }> = {
  greeting: {
    text: "Welcome to abuti Spinach! Your personal farming assistant with a bit of sass and a lot of science. So tell me — is this your first time here, or are you a returning legend?",
    icon: "greeting",
  },
  "tour-intro": {
    text: "Alright, I'm abuti Spinach — your personal farming assistant who actually knows what they're talking about. Unlike your uncle's advice about planting by the moon, I use actual science. And maybe a little sass.",
    icon: "tour-intro",
  },
  "tour-voice": {
    text: "First up — you can talk to me. Like, actually talk. Tap the microphone and ask me anything. Soil health, crop rotation, why your tomatoes look sad — I've got answers.",
    icon: "tour-voice",
  },
  "tour-camera": {
    text: "Point your camera at any dodgy-looking leaf, suspicious bug, or mysterious spot on your crop. I'll tell you exactly what's eating your lunch. Literally. Just say 'take a picture' or tap the camera button.",
    icon: "tour-camera",
  },
  "tour-offline": {
    text: "No data? No wifi? No problem. Dial star 384 star 87343 hash on any phone for USSD access. Or just send me an SMS. You don't need a smartphone to be a smart farmer.",
    icon: "tour-offline",
  },
  "tour-agent": {
    text: "Here's the game-changer — the Abuti Agent Crew. Three AI agents work autonomously to analyse markets, negotiate with buyers, and coordinate logistics. You set the rules, they execute the deals. This is farming's future.",
    icon: "tour-agent",
  },
  "tour-done": {
    text: "You're all caught up. Voice, camera, USSD, SMS, and an autonomous AI crew — basically an entire agricultural department in your pocket. Let's get to work.",
    icon: "tour-done",
  },
  returning: {
    text: "A returning champion! No need for the tour — you already know I'm brilliant. Let's skip the small talk and get straight to making deals.",
    icon: "returning",
  },
};

const STAGE_ICONS = {
  greeting: Leaf,
  "tour-intro": User,
  "tour-voice": Mic,
  "tour-camera": Camera,
  "tour-offline": Wifi,
  "tour-agent": TrendingUp,
  "tour-done": Rocket,
  returning: Trophy,
};

interface VoiceOnboardingProps {
  onComplete: () => void;
  onEmotionChange?: (emotion: "curious" | "happy" | "laughing" | "thinking") => void;
}

const VoiceOnboarding = ({ onComplete, onEmotionChange }: VoiceOnboardingProps) => {
  const [stage, setStage] = useState<OnboardingStage>("greeting");
  const [displayText, setDisplayText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showContinue, setShowContinue] = useState(false);
  const recognitionRef = useRef<any>(null);
  const hasStartedRef = useRef(false);

  const speak = useCallback((text: string, onDone?: () => void) => {
    window.speechSynthesis.cancel();
    const clean = cleanForTTS(text);
    if (!clean) { onDone?.(); return; }
    setIsSpeaking(true);
    const utterance = createUtterance(text);
    utterance.onend = () => { setIsSpeaking(false); onDone?.(); };
    utterance.onerror = () => { setIsSpeaking(false); onDone?.(); };
    window.speechSynthesis.speak(utterance);
  }, []);

  const typeText = useCallback((text: string, cb?: () => void) => {
    setDisplayText("");
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayText(text.slice(0, i));
      if (i >= text.length) { clearInterval(interval); cb?.(); }
    }, 22);
    return () => clearInterval(interval);
  }, []);

  const listenForAnswer = useCallback(() => {
    if (!SpeechRecognition) { setShowContinue(true); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-ZA";
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      setIsListening(false);
      const transcript = event.results[0][0].transcript.toLowerCase();
      if (/yes|yeah|yep|ja|first|new|first time|yebo/.test(transcript)) {
        setStage("tour-intro");
      } else {
        setStage("returning");
      }
    };
    recognition.onerror = () => { setIsListening(false); setShowContinue(true); };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const playStage = useCallback((stageKey: string) => {
    const script = TOUR_SCRIPTS[stageKey];
    if (!script) return;
    setShowContinue(false);
    onEmotionChange?.(stageKey === "greeting" ? "curious" : stageKey === "tour-done" || stageKey === "returning" ? "happy" : "laughing");
    typeText(script.text);
    speak(script.text, () => {
      if (stageKey === "greeting") {
        setStage("waiting-answer");
        listenForAnswer();
      } else {
        setShowContinue(true);
      }
    });
  }, [speak, typeText, listenForAnswer, onEmotionChange]);

  useEffect(() => {
    if (stage === "waiting-answer" || stage === "complete") return;
    const timer = setTimeout(() => {
      if (stage === "greeting" && !hasStartedRef.current) {
        hasStartedRef.current = true;
        playStage("greeting");
      } else if (stage !== "greeting") {
        playStage(stage);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [stage, playStage]);

  const handleNext = useCallback(() => {
    const flow: OnboardingStage[] = ["tour-intro", "tour-voice", "tour-camera", "tour-offline", "tour-agent", "tour-done"];
    const idx = flow.indexOf(stage);
    if (idx >= 0 && idx < flow.length - 1) {
      setStage(flow[idx + 1]);
    } else {
      window.speechSynthesis.cancel();
      onComplete();
    }
  }, [stage, onComplete]);

  const handleSkip = useCallback(() => {
    window.speechSynthesis.cancel();
    onComplete();
  }, [onComplete]);

  const handleFirstTimeAnswer = useCallback((isFirst: boolean) => {
    setStage(isFirst ? "tour-intro" : "returning");
  }, []);

  const currentScript = TOUR_SCRIPTS[stage] || TOUR_SCRIPTS.greeting;
  const tourStages: OnboardingStage[] = ["tour-intro", "tour-voice", "tour-camera", "tour-offline", "tour-agent", "tour-done"];
  const tourIndex = tourStages.indexOf(stage);
  const isTourStage = tourIndex >= 0;

  const IconComponent = STAGE_ICONS[currentScript.icon as keyof typeof STAGE_ICONS] || Leaf;

  return (
    <div
      className="flex flex-col items-center gap-4 w-full px-5"
      style={{ maxWidth: 360, animation: "onboardSlide 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }}
    >
      {/* Speech bubble */}
      <div className="relative w-full">
        <div style={{
          position: "absolute", top: -6, left: "50%", transform: "translateX(-50%) rotate(45deg)",
          width: 12, height: 12,
          background: "hsla(0, 0%, 100%, 0.72)",
          borderTop: "1px solid hsla(0, 0%, 100%, 0.6)",
          borderLeft: "1px solid hsla(0, 0%, 100%, 0.6)",
        }} />
        <div style={{
          padding: "18px 20px",
          borderRadius: 20,
          background: "hsla(0, 0%, 100%, 0.72)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 4px 24px hsla(130, 20%, 30%, 0.06)",
          border: "1px solid hsla(0, 0%, 100%, 0.6)",
          minHeight: 80,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "hsla(130, 35%, 45%, 0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <IconComponent size={16} color="hsl(130, 35%, 42%)" strokeWidth={2} />
            </div>
            {isSpeaking && (
              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 3, height: 12, borderRadius: 2,
                    background: "hsl(135, 35%, 45%)",
                    animation: `soundBar 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
                  }} />
                ))}
              </div>
            )}
          </div>

          <p style={{
            fontSize: 14, lineHeight: 1.65,
            color: "hsl(0, 0%, 22%)", fontFamily: FONT, margin: 0,
          }}>
            {displayText}
            {isSpeaking && <span style={{ animation: "blink 0.8s infinite" }}>|</span>}
          </p>
        </div>
      </div>

      {/* Progress dots */}
      {isTourStage && (
        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          {tourStages.map((_, i) => (
            <div key={i} style={{
              width: i === tourIndex ? 18 : 6, height: 6, borderRadius: 3,
              background: i <= tourIndex ? "hsl(135, 35%, 45%)" : "hsla(0, 0%, 0%, 0.1)",
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>
      )}

      {/* Listening indicator */}
      {isListening && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          animation: "onboardSlide 0.3s ease",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "hsl(135, 35%, 45%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "voicePulse 1.5s ease-in-out infinite",
            boxShadow: "0 0 0 8px hsla(135, 35%, 45%, 0.15)",
          }}>
            <Mic size={20} color="white" />
          </div>
          <span style={{ fontSize: 12, color: "hsl(0, 0%, 50%)", fontFamily: FONT }}>
            Listening — say "yes" or "no"
          </span>
        </div>
      )}

      {/* Yes/No buttons */}
      {stage === "waiting-answer" && showContinue && !isListening && (
        <div style={{ display: "flex", gap: 10, animation: "onboardSlide 0.3s ease" }}>
          <button
            onClick={() => handleFirstTimeAnswer(true)}
            style={{
              padding: "10px 24px", borderRadius: 14, border: "none",
              background: "hsl(135, 35%, 45%)", color: "hsl(0, 0%, 100%)",
              fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Leaf size={14} /> Yes, first time
          </button>
          <button
            onClick={() => handleFirstTimeAnswer(false)}
            style={{
              padding: "10px 24px", borderRadius: 14,
              border: "1px solid hsla(0, 0%, 0%, 0.08)",
              background: "hsla(0, 0%, 100%, 0.6)", color: "hsl(0, 0%, 35%)",
              fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: FONT,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Trophy size={14} /> I'm back
          </button>
        </div>
      )}

      {/* Continue / Skip */}
      {showContinue && stage !== "waiting-answer" && (
        <div style={{
          display: "flex", gap: 10, alignItems: "center",
          animation: "onboardSlide 0.3s ease",
        }}>
          <button
            onClick={handleNext}
            style={{
              padding: "10px 28px", borderRadius: 14, border: "none",
              background: "hsl(135, 35%, 45%)", color: "hsl(0, 0%, 100%)",
              fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
              display: "flex", alignItems: "center", gap: 6,
              transition: "all 0.2s",
            }}
          >
            {stage === "tour-done" || stage === "returning" ? (
              <><Rocket size={14} /> Let's go</>
            ) : (
              <>Next <span style={{ fontSize: 13 }}>→</span></>
            )}
          </button>
          {isTourStage && stage !== "tour-done" && (
            <button
              onClick={handleSkip}
              style={{
                padding: "10px 16px", borderRadius: 14, border: "none",
                background: "transparent", color: "hsl(0, 0%, 55%)",
                fontSize: 13, cursor: "pointer", fontFamily: FONT,
              }}
            >
              Skip tour
            </button>
          )}
        </div>
      )}

      {/* Tap to retry voice */}
      {stage === "waiting-answer" && !isListening && !showContinue && (
        <button
          onClick={listenForAnswer}
          style={{
            padding: "8px 20px", borderRadius: 12, border: "none",
            background: "hsla(135, 30%, 48%, 0.15)", color: "hsl(135, 35%, 40%)",
            fontSize: 13, cursor: "pointer", fontFamily: FONT,
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <Mic size={14} /> Tap to answer
        </button>
      )}

      <style>{`
        @keyframes onboardSlide {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes soundBar {
          from { height: 4px; }
          to { height: 14px; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes voicePulse {
          0%, 100% { box-shadow: 0 0 0 8px hsla(135, 35%, 45%, 0.15); }
          50% { box-shadow: 0 0 0 14px hsla(135, 35%, 45%, 0.06); }
        }
      `}</style>
    </div>
  );
};

export default VoiceOnboarding;
