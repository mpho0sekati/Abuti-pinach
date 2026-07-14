import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { Product } from "@/components/ProductCarousel";
import type { MarketPrediction } from "@/components/MarketPredictionCard";
import type { BiosecurityData } from "@/components/BiosecurityCard";
import { createUtterance, cleanForTTS, getBestVoice } from "@/utils/tts";
import { Emotion } from "@/components/GreenOrb";
import { WeatherData, WeatherStatus } from "@/hooks/useWeather";
import { Mic, Camera, Cloud, TrendingUp, Shield, Accessibility, Wifi, Phone, Rocket, Globe, Leaf, User, MapPin, ChevronRight, Sparkles } from "lucide-react";
import CameraCapture from "@/components/CameraCapture";
import { setCache, getCache } from "@/utils/offlineCache";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const PLANS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/farm-plans`;
const SMS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-sms`;
const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const CAMERA_TRIGGERS = ["take a picture", "take photo", "scan", "camera", "show me", "look at", "analyze this", "what is this", "pest", "disease", "check my crop"];

type Phase = "idle" | "onboarding" | "chat";
type OnboardingStep = "ask-lang" | "ask-name" | "greeting" | "ask-location" | "tour-intro" | "tour-voice" | "tour-camera" | "tour-weather" | "tour-market" | "tour-biosecurity" | "tour-accessibility" | "tour-offline" | "ask-phone" | "tour-done";
type Msg = { role: "user" | "assistant"; content: string; image?: string; logId?: string };

const TOUR_STEPS: OnboardingStep[] = ["tour-intro", "tour-voice", "tour-camera", "tour-weather", "tour-market", "tour-biosecurity", "tour-accessibility", "tour-offline", "ask-phone", "tour-done"];

const SCRIPTS: Record<string, Record<string, string>> = {
  en: {
    "ask-name": "Hi! I'm abuti Spinach. What should I call you?",
    greeting: "Great, NAME. I’ll help you farm smarter. Ready to set things up?",
    "ask-location": "Can I use your location to give you better weather advice?",
    "tour-intro": "Quick tour, NAME. I’ll show you the main tools.",
    "tour-voice": "Talk to me by tapping the orb or saying \"Orb\". Ask about soil, crops, prices, weather, or pests.",
    "tour-camera": "Use the camera button to scan a plant. I can diagnose crop and pest issues from a photo.",
    "tour-weather": "I’ll keep weather updates ready for your farm. If danger is coming, I’ll warn you fast.",
    "tour-market": "Ask about prices and I’ll spot market trends and selling opportunities.",
    "tour-biosecurity": "Tell me about your animals and I’ll help with disease risk, vaccinations, and quarantine steps.",
    "tour-accessibility": "Top-left is accessibility. Turn on high contrast and larger targets if you need them.",
    "tour-offline": "No internet? I can still send advice by SMS.",
    "ask-phone": "Add your phone number for alerts, market tips, and your planting calendar by SMS.",
    "tour-done": "That’s it, NAME. You’re ready to start farming with abuti.",
    returning: "Welcome back, NAME. Ready to ask something or check your farm?",
  },
  zu: {
    "ask-name": "Sawubona! NginguAbuti Spinach. Ungibiza kanjani?",
    greeting: "Kuhle, NAME. Ngizokusiza ukulima ngendlela ehlakaniphile. Ukulungele ukusetha?",
    "ask-location": "Ngingasebenzisa indawo yakho ukuthola isimo sezulu esingcono?",
    "tour-intro": "Umzuzu omfushane, NAME. Ngizokukhombisa amathuluzi amakhulu.",
    "tour-voice": "Thepha i-orb noma usho \"Orb\". Buza ngezithombo, izitshalo, amanani, isimo sezulu, noma izilokazane.",
    "tour-camera": "Sebenzisa inkinobho yekhamera ukubheka isitshalo. Ngizokuhlola izinkinga zesitshalo kusuka esithombeni.",
    "tour-weather": "Ngizogcina isimo sezulu sikulungele. Uma kukhona ingozi, ngizokuxwayisa ngokushesha.",
    "tour-market": "Buza ngamanani, futhi ngizokutshela izinto ezishisayo zemakethe.",
    "tour-biosecurity": "Ungitshele ngezilwane zakho futhi ngizokusiza ngezingozi zezibazi, izigxivizo, nezinyathelo zokuhlukanisa.",
    "tour-accessibility": "Phezulu kwesobunxele kunezinketho zokufinyelela. Vula ukuhlukanisa okuphezulu namathuba amakhulu wokuthinta.",
    "tour-offline": "Awunayo i-inthanethi? Ngingakuthumelela iseluleko nge-SMS.",
    "ask-phone": "Faka inombolo yakho yocingo ukuthola izexwayiso, amathiphu emakethe, nekhalenda yokutshala nge-SMS.",
    "tour-done": "Sekuphelile, NAME. Usukulungele ukulima no-Abuti.",
    returning: "Siyakwamukela emuva, NAME. Ingabe ufuna ukubuza noma ukubheka ifamu yakho?",
  },
};

export type WeatherAlertLevel = "none" | "moderate" | "severe";

interface OrbControllerProps {
  onEmotionChange: (emotion: Emotion) => void;
  onCaptionChange: (text: string) => void;
  onSubtitleChange: (text: string) => void;
  onRegisterTap: (handler: () => void) => void;
  weather?: WeatherData | null;
  weatherStatus?: WeatherStatus;
  onRequestLocation?: () => void;
  onLastLogIdChange?: (logId: string | null) => void;
  onWeatherAlertChange?: (level: WeatherAlertLevel) => void;
  onProductsChange?: (products: Product[] | null) => void;
  onMarketPredictions?: (predictions: MarketPrediction[] | null) => void;
  onBiosecurityData?: (data: BiosecurityData | null) => void;
  onWeatherPopup?: () => void;
  onMarketLoading?: (loading: boolean) => void;
  onBioLoading?: (loading: boolean) => void;
}

const OrbController = ({ onEmotionChange, onCaptionChange, onSubtitleChange, onRegisterTap, weather, weatherStatus, onRequestLocation, onLastLogIdChange, onWeatherAlertChange, onProductsChange, onMarketPredictions, onBiosecurityData, onWeatherPopup, onMarketLoading, onBioLoading }: OrbControllerProps) => {
  const { session } = useAuth();
  const sessionIdRef = useRef(`web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const [phase, setPhase] = useState<Phase>("idle");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  useEffect(() => {
    if (showCamera) {
      onEmotionChange("curious");
      onSubtitleChange("I can see what you see — ask me anything");
    } else {
      onSubtitleChange("");
    }
  }, [showCamera, onEmotionChange, onSubtitleChange]);
  const [showTextInput, setShowTextInput] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const [buttonType, setButtonType] = useState<"yesno" | "next" | "go" | "location" | "name-input" | "lang-select" | "phone-input" | null>(null);
  const [input, setInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [farmerPhone, setFarmerPhone] = useState(() => localStorage.getItem("abuti_phone") || "");
  const [userName, setUserName] = useState(() => localStorage.getItem("agri_user_name") || "");
  const [lang, setLang] = useState<string>(() => localStorage.getItem("abuti_lang") || "");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [farmPlans, setFarmPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("ask-lang");
  const inputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const hasStartedRef = useRef(false);
  const wakeWordRef = useRef<any>(null);
  const wakeWordActiveRef = useRef(false);

  const describeCameraError = useCallback((err: any) => {
    const name = err?.name || "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      return "Camera access was blocked. Allow the camera for this site, then tap Start live vision.";
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was detected on this desktop.";
    if (name === "NotReadableError") return "Your camera is already being used by another app. Close it, then retry.";
    return "The live lens could not start. Tap Start live vision to try again.";
  }, []);

  const openLiveCamera = useCallback(async () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Your browser does not support live camera access. Try Chrome, Edge, or Safari.");
      setShowCamera(true);
      return;
    }
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      setCameraError("Camera access needs a secure connection.");
      setShowCamera(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setCameraStream(stream);
      setShowCamera(true);
    } catch (firstErr) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setCameraStream(stream);
        setShowCamera(true);
      } catch (err) {
        setCameraError(describeCameraError(err || firstErr));
        setShowCamera(true);
      }
    }
  }, [cameraStream, describeCameraError]);

  const closeLiveCamera = useCallback(() => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraError(null);
    setShowCamera(false);
  }, [cameraStream]);

  const currentLang = lang || "en";
  const t = useCallback((key: string) => {
    const scripts = SCRIPTS[currentLang === "zu" ? "zu" : "en"];
    return (scripts[key] || SCRIPTS.en[key] || "").replace(/NAME/g, userName || (currentLang === "zu" ? "mngane" : "friend"));
  }, [currentLang, userName]);

  // Sentiment detection for context-aware emotions
  const detectSentiment = useCallback((text: string): Emotion => {
    const lower = text.toLowerCase();
    const worried = /disease|pest|infect|wilt|rot|damage|die|dying|dead|fungus|blight|danger|warning|careful|unfortunately|bad news|problem|issue|concern/i;
    const excited = /excellent|amazing|wonderful|fantastic|great news|perfect|thriving|healthy|bumper|harvest|congratulations|well done|impressive/i;
    const eyebrow = /hmm|interesting|however|but|actually|well well|curious|strange|unusual/i;
    
    if (worried.test(lower)) return "worried";
    if (excited.test(lower)) return "excited";
    if (eyebrow.test(lower)) return "eyebrow-raise";
    return "speaking";
  }, []);

  // Track current response sentiment
  const currentSentimentRef = useRef<Emotion>("speaking");

  // Expressive emotion cycling during speaking — alternate between emotions to feel alive
  const speakEmotionRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  useEffect(() => {
    if (isSpeaking) {
      const baseSentiment = currentSentimentRef.current;
      // Build emotion cycle based on sentiment
      const getCycle = (): Emotion[] => {
        if (baseSentiment === "worried") return ["worried", "speaking", "worried", "thinking", "worried"];
        if (baseSentiment === "excited") return ["excited", "happy", "excited", "laughing", "excited", "happy"];
        if (baseSentiment === "eyebrow-raise") return ["eyebrow-raise", "speaking", "curious", "speaking", "eyebrow-raise"];
        return ["speaking", "happy", "speaking", "curious", "speaking", "eyebrow-raise", "speaking", "happy"];
      };
      const emotions = getCycle();
      let idx = 0;
      onEmotionChange(emotions[0]);
      speakEmotionRef.current = setInterval(() => {
        idx = (idx + 1) % emotions.length;
        onEmotionChange(emotions[idx]);
      }, 1800 + Math.random() * 1200);
      return () => clearInterval(speakEmotionRef.current);
    } else if (isLoading) {
      onEmotionChange("thinking");
    } else if (isListening) {
      const emotions: Emotion[] = ["listening", "curious", "listening", "eyebrow-raise", "listening"];
      let idx = 0;
      onEmotionChange("listening");
      speakEmotionRef.current = setInterval(() => {
        idx = (idx + 1) % emotions.length;
        onEmotionChange(emotions[idx]);
      }, 2500 + Math.random() * 1500);
      return () => clearInterval(speakEmotionRef.current);
    } else if (phase === "idle") {
      onEmotionChange("neutral");
    } else if (phase === "chat") {
      onEmotionChange("neutral");
    } else {
      onEmotionChange("happy");
    }
  }, [isLoading, isSpeaking, isListening, phase, onEmotionChange]);

  // Browser-native TTS — speaks full text at once (used for onboarding scripts)
  const speak = useCallback((text: string, onDone?: () => void) => {
    window.speechSynthesis.cancel();
    const clean = cleanForTTS(text);
    if (!clean) { onDone?.(); return; }

    setIsSpeaking(true);
    onCaptionChange(text);

    const utterance = createUtterance(text);
    utterance.onend = () => { setIsSpeaking(false); onDone?.(); };
    utterance.onerror = () => { setIsSpeaking(false); onDone?.(); };
    window.speechSynthesis.speak(utterance);
  }, [onCaptionChange]);

  // Streaming TTS — speaks sentence-by-sentence as text streams in
  const ttsQueueRef = useRef<string[]>([]);
  const ttsSpeakingRef = useRef(false);
  const ttsStreamDoneRef = useRef(false);

  const speakNextChunk = useCallback(() => {
    if (ttsSpeakingRef.current || ttsQueueRef.current.length === 0) {
      // If queue empty and stream done, we're finished speaking
      if (ttsStreamDoneRef.current && ttsQueueRef.current.length === 0 && !ttsSpeakingRef.current) {
        setIsSpeaking(false);
      }
      return;
    }

    const chunk = ttsQueueRef.current.shift()!;
    const clean = cleanForTTS(chunk);
    if (!clean) { speakNextChunk(); return; }

    ttsSpeakingRef.current = true;
    const utterance = createUtterance(chunk);
    utterance.onend = () => { ttsSpeakingRef.current = false; speakNextChunk(); };
    utterance.onerror = () => { ttsSpeakingRef.current = false; speakNextChunk(); };
    window.speechSynthesis.speak(utterance);
  }, []);

  const enqueueTTSChunk = useCallback((sentence: string) => {
    ttsQueueRef.current.push(sentence);
    if (!ttsSpeakingRef.current) {
      setIsSpeaking(true);
      speakNextChunk();
    }
  }, [speakNextChunk]);

  const startStreamingTTS = useCallback(() => {
    window.speechSynthesis.cancel();
    ttsQueueRef.current = [];
    ttsSpeakingRef.current = false;
    ttsStreamDoneRef.current = false;
  }, []);

  const finishStreamingTTS = useCallback((remainder: string) => {
    // Enqueue any leftover text that didn't end with punctuation
    if (remainder.trim()) {
      enqueueTTSChunk(remainder);
    }
    ttsStreamDoneRef.current = true;
    // If nothing is playing, check if we should stop
    if (!ttsSpeakingRef.current && ttsQueueRef.current.length === 0) {
      setIsSpeaking(false);
    }
  }, [enqueueTTSChunk]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    ttsQueueRef.current = [];
    ttsSpeakingRef.current = false;
    ttsStreamDoneRef.current = true;
    setIsSpeaking(false);
  }, []);

  // Speech recognition
  const startListening = useCallback((onResult: (text: string) => void) => {
    if (!SpeechRecognition) { setShowTextInput(true); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = currentLang === "zu" ? "zu-ZA" : "en-ZA";
    recognition.onstart = () => { setIsListening(true); onSubtitleChange("Listening..."); };
    recognition.onresult = (event: any) => {
      setIsListening(false);
      onSubtitleChange("");
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };
    recognition.onerror = () => { setIsListening(false); onSubtitleChange(""); setShowTextInput(true); };
    recognition.onend = () => { setIsListening(false); };
    recognitionRef.current = recognition;
    recognition.start();
  }, [onSubtitleChange]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    onSubtitleChange("");
  }, [onSubtitleChange]);

  // === WAKE WORD DETECTION ("orb") ===
  const handleTapRef = useRef<() => void>(() => {});
  
  const startWakeWordListener = useCallback(() => {
    if (!SpeechRecognition || wakeWordActiveRef.current) return;
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = currentLang === "zu" ? "zu-ZA" : "en-ZA";
    
    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase().trim();
        if (transcript.includes("orb") || transcript.includes("orbe") || transcript.includes("awb")) {
          recognition.stop();
          wakeWordActiveRef.current = false;
          wakeWordRef.current = null;
          // Activate listening mode (same as tapping the orb)
          handleTapRef.current();
          return;
        }
      }
    };
    
    recognition.onend = () => {
      if (wakeWordActiveRef.current) {
        try { recognition.start(); } catch {}
      }
    };
    
    recognition.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wakeWordActiveRef.current = false;
        return;
      }
      if (wakeWordActiveRef.current) {
        setTimeout(() => { try { recognition.start(); } catch {} }, 1000);
      }
    };
    
    wakeWordActiveRef.current = true;
    wakeWordRef.current = recognition;
    try { recognition.start(); } catch {}
  }, [currentLang]);

  const stopWakeWordListener = useCallback(() => {
    wakeWordActiveRef.current = false;
    wakeWordRef.current?.stop();
    wakeWordRef.current = null;
  }, []);

  // Start/stop wake word listener based on phase and activity
  useEffect(() => {
    if (phase === "chat" && !isSpeaking && !isListening && !isLoading) {
      const timer = setTimeout(() => startWakeWordListener(), 500);
      return () => { clearTimeout(timer); stopWakeWordListener(); };
    } else {
      stopWakeWordListener();
    }
  }, [phase, isSpeaking, isListening, isLoading, startWakeWordListener, stopWakeWordListener]);

  // === ONBOARDING ===
  const goToChat = useCallback(() => {
    setPhase("chat");
    setShowButtons(false);
    onSubtitleChange("Say \"Orb\" or tap to talk");
    onCaptionChange("");
  }, [onSubtitleChange, onCaptionChange]);

  const playOnboardingStep = useCallback((step: OnboardingStep) => {
    setShowButtons(false);
    setButtonType(null);

    if (step === "ask-lang") {
      // If lang already set (returning visit), skip
      if (lang) {
        setOnboardingStep("ask-name");
        return;
      }
      setShowButtons(true);
      setButtonType("lang-select" as any);
      return;
    }

    if (step === "ask-name") {
      // If returning user with name, skip straight to returning greeting
      if (userName) {
        speak(t("returning"), goToChat);
        return;
      }
      speak(t("ask-name"), () => {
        setShowButtons(true);
        setButtonType("name-input");
        setTimeout(() => nameInputRef.current?.focus(), 100);
        startListening((name) => {
          const cleanName = name.trim().split(" ")[0];
          if (cleanName) {
            setUserName(cleanName);
            localStorage.setItem("agri_user_name", cleanName);
            setShowButtons(false);
            setOnboardingStep("greeting");
          }
        });
      });
    } else if (step === "greeting") {
      speak(t("greeting"), () => {
        setShowButtons(true);
        setButtonType("yesno");
      });
    } else if (step === "ask-location") {
      speak(t("ask-location"), () => {
        setShowButtons(true);
        setButtonType("location");
      });
    } else if (step === "ask-phone") {
      // If phone already saved, skip
      if (farmerPhone) {
        setOnboardingStep("tour-done");
        return;
      }
      speak(t("ask-phone"), () => {
        setShowButtons(true);
        setButtonType("phone-input");
        setTimeout(() => phoneInputRef.current?.focus(), 100);
      });
    } else if (step === "tour-done") {
      speak(t("tour-done"), () => {
        setShowButtons(true);
        setButtonType("go");
      });
    } else {
      const script = t(step);
      if (script) {
        speak(script, () => {
          setShowButtons(true);
          setButtonType("next");
        });
      }
    }
  }, [speak, startListening, t, userName, lang, goToChat]);

  useEffect(() => {
    if (phase !== "onboarding") return;
    playOnboardingStep(onboardingStep);
  }, [onboardingStep, phase, playOnboardingStep]);

  // Watch for weather status changes during onboarding
  useEffect(() => {
    if (onboardingStep !== "ask-location" || phase !== "onboarding") return;
    if (weatherStatus === "granted" && weather) {
      setShowButtons(false);
      speak(`Got it! You're near ${weather.locationName}. ${weather.temperature}°C, ${weather.description}. I'll factor that into every answer. Smart farming starts with smart data.`, () => {
        setOnboardingStep("tour-intro");
      });
    } else if (weatherStatus === "denied" || weatherStatus === "error") {
      setShowButtons(false);
      speak("No worries — I can still help without knowing exactly where you are. You can always share later.", () => {
        setOnboardingStep("tour-intro");
      });
    }
  }, [weatherStatus, weather, onboardingStep, phase, speak]);

  // Auto-request location and fetch farm plans when entering chat
  useEffect(() => {
    if (phase === "chat") {
      if (weatherStatus === "idle" && onRequestLocation) onRequestLocation();
      // Fetch existing farm plans for this session
      const fetchPlans = async () => {
        try {
          const resp = await fetch(PLANS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: JSON.stringify({ action: "get", sessionId: sessionIdRef.current }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.plans) setFarmPlans(data.plans);
          }
        } catch {}
      };
      fetchPlans();
    }
  }, [phase, weatherStatus, onRequestLocation]);

  // === PROACTIVE WEATHER WARNINGS ===
  const lastWeatherAlertRef = useRef<string>("");
  const weatherCheckIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const weatherAlertSentRef = useRef(false);

  // Check weather conditions and warn proactively
  useEffect(() => {
    if (phase !== "chat" || !weather || isSpeaking || isListening || isLoading) return;

    const checkWeatherWarnings = () => {
      if (isSpeaking || isListening || isLoading || weatherAlertSentRef.current) return;

      const warnings: string[] = [];
      const { temperature, humidity, windSpeed, weatherCode, daily, description, locationName } = weather;

      // === NATURAL DISASTER & SEVERE WEATHER ===
      // Thunderstorms (including hail)
      if ([95, 96, 99].includes(weatherCode)) {
        warnings.push(`thunderstorm_${weatherCode}`);
      }
      // Violent rain showers (flood risk)
      if ([82].includes(weatherCode)) {
        warnings.push(`flood_risk_${weatherCode}`);
      }
      // Heavy rain
      if ([63, 65, 81].includes(weatherCode)) {
        warnings.push(`heavy_rain_${weatherCode}`);
      }
      // Extreme precipitation (flood/landslide risk)
      if (daily.precipitationSum >= 50) {
        warnings.push(`extreme_rainfall_flood_risk`);
      } else if (daily.precipitationProbability >= 70 && daily.precipitationSum >= 10) {
        warnings.push(`high_precip_${daily.precipitationProbability}`);
      }
      // Hurricane-force / destructive wind
      if (windSpeed >= 90) {
        warnings.push(`destructive_wind_${windSpeed}`);
      } else if (windSpeed >= 60) {
        warnings.push(`gale_force_wind_${windSpeed}`);
      } else if (windSpeed >= 40) {
        warnings.push(`strong_wind_${windSpeed}`);
      }
      // Extreme heat (wildfire / heatstroke risk)
      if (daily.maxTemp >= 42) {
        warnings.push(`extreme_heat_wildfire_risk_${daily.maxTemp}`);
      } else if (daily.maxTemp >= 35) {
        warnings.push(`heat_warning_${daily.maxTemp}`);
      }
      // Frost / freeze (crop kill risk)
      if (daily.minTemp <= 0) {
        warnings.push(`freeze_warning_${daily.minTemp}`);
      } else if (daily.minTemp <= 3) {
        warnings.push(`frost_risk_${daily.minTemp}`);
      }
      // Hail damage
      if ([96, 99].includes(weatherCode)) {
        warnings.push(`hail_damage_risk`);
      }
      // Dense fog (navigation/livestock hazard)
      if ([45, 48].includes(weatherCode)) {
        warnings.push(`dense_fog_${weatherCode}`);
      }
      // High humidity + heat (fungal disease risk)
      if (humidity >= 90 && temperature >= 20) {
        warnings.push(`fungal_risk_${humidity}`);
      }
      // Drought indicator (extreme heat + no rain)
      if (daily.maxTemp >= 32 && daily.precipitationSum === 0 && daily.precipitationProbability <= 10) {
        warnings.push(`drought_conditions`);
      }

      if (warnings.length === 0) {
        onWeatherAlertChange?.("none");
        return;
      }

      // Classify alert level: severe (red) vs moderate (orange)
      const severePatterns = ["thunderstorm", "flood_risk", "extreme_rainfall", "destructive_wind", "extreme_heat_wildfire", "freeze_warning", "hail_damage"];
      const isSevere = warnings.some(w => severePatterns.some(p => w.startsWith(p)));
      onWeatherAlertChange?.(isSevere ? "severe" : "moderate");

      const warningKey = warnings.sort().join("|");
      if (warningKey === lastWeatherAlertRef.current) return;
      lastWeatherAlertRef.current = warningKey;
      weatherAlertSentRef.current = true;

      // Build weather warning prompt for the AI
      const weatherDetails = `Location: ${locationName}, Current: ${description} ${temperature}°C, Humidity: ${humidity}%, Wind: ${windSpeed} km/h, Today's high: ${daily.maxTemp}°C, low: ${daily.minTemp}°C, Rain: ${daily.precipitationSum}mm (${daily.precipitationProbability}% chance)`;
      
      const warningPrompt = `[SYSTEM: URGENT WEATHER/NATURAL DISASTER ALERT for the farmer. Current conditions: ${weatherDetails}. Active warnings: ${warnings.map(w => w.replace(/_\d+.*$/, '').replace(/_/g, ' ')).join(', ')}. Give the farmer a SHORT, urgent but calm warning. For NATURAL DISASTERS (floods, hail, destructive wind, wildfire risk, freeze): emphasize SAFETY FIRST — protect yourself and family, then livestock, then crops. For severe weather: tell them WHAT to do RIGHT NOW — secure structures, move livestock to shelter, cover crops, clear drainage, harvest what you can. For drought: suggest water conservation and mulching. Be specific and actionable. Reference their farm plan tasks if relevant. 2-3 sentences max. This is critical — lives and livelihoods depend on it.]`;

      const warningMessages: Msg[] = [
        ...messages,
        { role: "user" as const, content: warningPrompt },
      ];

      const nameContext = userName ? `\n[Farmer's name: ${userName}]` : "";
      const contextMessages = warningMessages.map((m, i) => {
        const base: any = { role: m.role, content: m.content };
        if (i === 0 && m.role === "user") {
          base.content = `[Farmer speaking]${nameContext}\n[Current weather at ${locationName}: ${description}, ${temperature}°C, humidity ${humidity}%, wind ${windSpeed} km/h] ${m.content}`;
        }
        return base;
      });

      const fetchWarning = async () => {
        setIsLoading(true);
        onSubtitleChange("Weather alert...");
        onEmotionChange("worried");

        try {
          const resp = await fetch(CHAT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ messages: contextMessages, sessionId: sessionIdRef.current, channel: "web", userName: userName || undefined, farmPlans: farmPlans.length > 0 ? farmPlans : undefined, lang: currentLang === "zu" ? "zu" : "en-ZA" }),
          });

          if (!resp.ok || !resp.body) { setIsLoading(false); return; }

          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let assistantText = "";
          let ttsBuffer = "";

          startStreamingTTS();
          setIsSpeaking(true);
          onSubtitleChange("");

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let newlineIdx: number;
            while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, newlineIdx);
              buffer = buffer.slice(newlineIdx + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") break;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  assistantText += content;
                  ttsBuffer += content;
                  onCaptionChange(assistantText);
                  const sentenceMatch = ttsBuffer.match(/^([\s\S]*?[.!?…]\s)/);
                  if (sentenceMatch) {
                    const sentence = sentenceMatch[1];
                    ttsBuffer = ttsBuffer.slice(sentence.length);
                    enqueueTTSChunk(sentence);
                  }
                }
              } catch {
                buffer = line + "\n" + buffer;
                break;
              }
            }
          }

          if (assistantText) {
            setMessages(prev => [...prev, { role: "assistant", content: assistantText }]);
            currentSentimentRef.current = "worried";
            finishStreamingTTS(ttsBuffer);

            // Send weather alert SMS if farmer has a phone
            if (farmerPhone) {
              sendFarmSms(farmerPhone, "weather-alert", {
                description: weather.description,
                temperature: weather.temperature,
                locationName: weather.locationName,
                windSpeed: weather.windSpeed,
                humidity: weather.humidity,
                warnings: warnings.map(w => w.replace(/_\d+.*$/, "").replace(/_/g, " ")),
              });
            }
          }
        } catch {}
        setIsLoading(false);
      };

      fetchWarning();
    };

    // Check immediately on weather data arrival, then every 10 minutes
    const timeoutId = setTimeout(checkWeatherWarnings, 3000);
    weatherCheckIntervalRef.current = setInterval(checkWeatherWarnings, 10 * 60 * 1000);

    return () => {
      clearTimeout(timeoutId);
      if (weatherCheckIntervalRef.current) clearInterval(weatherCheckIntervalRef.current);
    };
  }, [phase, weather, isSpeaking, isListening, isLoading, messages, userName, farmPlans, startStreamingTTS, enqueueTTSChunk, finishStreamingTTS, onCaptionChange, onSubtitleChange, onEmotionChange, onWeatherAlertChange]);

  // === HOURLY WEATHER POPUP ===
  const weatherPopupIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  useEffect(() => {
    if (phase !== "chat" || !weather) return;
    // Show initial popup after 5 seconds
    const initialTimeout = setTimeout(() => {
      onWeatherPopup?.();
    }, 5000);
    // Then every hour
    weatherPopupIntervalRef.current = setInterval(() => {
      onWeatherPopup?.();
    }, 60 * 60 * 1000);
    return () => {
      clearTimeout(initialTimeout);
      if (weatherPopupIntervalRef.current) clearInterval(weatherPopupIntervalRef.current);
    };
  }, [phase, weather, onWeatherPopup]);

  // Save farm plans from AI tool call
  const saveFarmPlans = useCallback(async (tasks: any[]) => {
    if (!session) {
      enqueueTTSChunk("I've created a farm plan for you! To save it and get SMS reminders, please sign up or sign in.");
      return;
    }
    try {
      const resp = await fetch(PLANS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          action: "save",
          sessionId: sessionIdRef.current,
          plans: tasks.map(t => ({ ...t, farmer_name: userName || undefined })),
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.saved) setFarmPlans(prev => [...prev, ...data.saved]);
      }
    } catch (e) {
      console.error("Failed to save farm plans:", e);
    }
  }, [userName]);

  const handleTap = useCallback(() => {
    if (phase === "idle" && !hasStartedRef.current) {
      hasStartedRef.current = true;
      setPhase("onboarding");
      setOnboardingStep("ask-lang");
    } else if (phase === "chat") {
      if (isSpeaking) {
        stopSpeaking();
      } else if (isListening) {
        stopListening();
      } else {
        startListening((transcript) => {
          if (CAMERA_TRIGGERS.some(t => transcript.toLowerCase().includes(t))) {
            setCameraStream(null);
            setCameraError(null);
            setShowCamera(true);
          } else {
            sendChat(transcript);
          }
        });
      }
    }
  }, [phase, isSpeaking, isListening, stopSpeaking, stopListening, startListening]);

  // Register tap handler with parent and wake word ref
  useEffect(() => {
    onRegisterTap(handleTap);
    handleTapRef.current = handleTap;
  }, [handleTap, onRegisterTap]);

  // === IDLE ENGAGEMENT PROMPT ===
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const idleCountRef = useRef(0); // Track how many idle prompts sent this session

  // Reset idle timer on any user activity
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  }, []);

  // Start idle timer when in chat and not busy
  useEffect(() => {
    if (phase !== "chat" || isSpeaking || isListening || isLoading) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      return;
    }

    // Max 2 idle prompts per session to avoid being annoying
    if (idleCountRef.current >= 2) return;

    // Increase delay each time: 45s first, 90s second
    const delay = (idleCountRef.current === 0 ? 45 : 90) * 1000;

    idleTimerRef.current = setTimeout(() => {
      idleCountRef.current += 1;

      // Analyze conversation mood — skip jokes if last messages were serious
      const recentMessages = messages.slice(-3);
      const lastContent = recentMessages.map(m => m.content.toLowerCase()).join(" ");
      const seriousKeywords = ["dying", "dead", "disease", "lost", "drought", "flood", "destroyed", "help", "emergency", "urgent", "problem", "damage", "infestation", "crisis"];
      const isSeriousContext = seriousKeywords.some(kw => lastContent.includes(kw));

      const lastTopic = messages.length > 0 ? messages[messages.length - 1].content : "";

      // Check for overdue/upcoming farm plan tasks
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const overdueTasks = farmPlans.filter(p => p.status === "pending" && p.due_date < todayStr);
      const upcomingTasks = farmPlans.filter(p => p.status === "pending" && p.due_date >= todayStr && p.due_date <= new Date(now.getTime() + 3 * 86400000).toISOString().split("T")[0]);

      let idlePrompt: string;
      if (overdueTasks.length > 0) {
        idlePrompt = `[SYSTEM: The farmer has been quiet. They have ${overdueTasks.length} overdue task(s) on their farm plan: ${overdueTasks.map(t => `"${t.task_title}" (due ${t.due_date})`).join(", ")}. Gently check in on their progress — ask if they've done it or need help. Be supportive, not nagging. 1-2 sentences.]`;
      } else if (upcomingTasks.length > 0) {
        idlePrompt = `[SYSTEM: The farmer has been quiet. They have upcoming tasks: ${upcomingTasks.map(t => `"${t.task_title}" (due ${t.due_date})`).join(", ")}. Give them a friendly reminder or ask if they're ready. 1-2 sentences.]`;
      } else if (isSeriousContext) {
        idlePrompt = `[SYSTEM: The farmer has been quiet. The conversation was about a serious issue. DO NOT joke. Instead, gently check in — ask if they need more help, suggest a next step, or offer encouragement. Be warm and supportive. 1-2 sentences max.]`;
      } else if (lastTopic) {
        idlePrompt = `[SYSTEM: The farmer has been quiet for a while. Generate a unique, contextually relevant check-in. You can use a quick farming pun, ask a follow-up question about "${lastTopic.slice(0, 80)}", or share a quick farming tip. Be creative — never repeat the same opener. Keep it to 1-2 sentences.]`;
      } else {
        idlePrompt = `[SYSTEM: The farmer has been quiet. Give them a quick, unique farming tip or ask what they're growing. Be casual and natural. 1-2 sentences max.]`;
      }

      const idleMessages: Msg[] = [
        ...messages,
        { role: "user" as const, content: idlePrompt },
      ];

      const fetchIdleResponse = async () => {
        setIsLoading(true);
        onSubtitleChange(overdueTasks.length > 0 ? "Checking your plan..." : "Hmm, too quiet...");

        const weatherContext = weather
          ? `\n[Current weather at ${weather.locationName}: ${weather.description}, ${weather.temperature}°C]`
          : "";
        const nameContext = userName ? `\n[Farmer's name: ${userName}]` : "";

        const contextMessages = idleMessages.map((m, i) => {
          const base: any = { role: m.role, content: m.content };
          if (i === 0 && m.role === "user") {
            base.content = `[Farmer speaking]${nameContext}${weatherContext} ${m.content}`;
          }
          return base;
        });

        try {
          const resp = await fetch(CHAT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ messages: contextMessages, sessionId: sessionIdRef.current, channel: "web", userName: userName || undefined, farmPlans: farmPlans.length > 0 ? farmPlans : undefined, lang: currentLang === "zu" ? "zu" : "en-ZA" }),
          });

          if (!resp.ok || !resp.body) {
            setIsLoading(false);
            return;
          }

          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let assistantText = "";
          let ttsBuffer = "";

          startStreamingTTS();
          setIsSpeaking(true);
          onSubtitleChange("");

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let newlineIdx: number;
            while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, newlineIdx);
              buffer = buffer.slice(newlineIdx + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") break;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  assistantText += content;
                  ttsBuffer += content;
                  onCaptionChange(assistantText);

                  const sentenceMatch = ttsBuffer.match(/^([\s\S]*?[.!?…]\s)/);
                  if (sentenceMatch) {
                    const sentence = sentenceMatch[1];
                    ttsBuffer = ttsBuffer.slice(sentence.length);
                    enqueueTTSChunk(sentence);
                  }
                }
              } catch {
                buffer = line + "\n" + buffer;
                break;
              }
            }
          }

          if (assistantText) {
            setMessages(prev => [...prev, { role: "assistant", content: assistantText }]);
            currentSentimentRef.current = detectSentiment(assistantText);
            finishStreamingTTS(ttsBuffer);
          }
        } catch {
          // Silent fail
        }
        setIsLoading(false);
      };

      fetchIdleResponse();
    }, delay);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [phase, isSpeaking, isListening, isLoading, messages, weather, userName, farmPlans, speak, startStreamingTTS, enqueueTTSChunk, finishStreamingTTS, detectSentiment, onCaptionChange, onSubtitleChange]);

  // Reset idle timer when user sends a message
  useEffect(() => {
    resetIdleTimer();
  }, [messages.length, resetIdleTimer]);

  // === CHAT ===
  const sendChat = useCallback(async (text?: string, imageBase64?: string) => {
    const msg = (text || input).trim();
    if ((!msg && !imageBase64) || isLoading) return;

    const userMsg: Msg = {
      role: "user",
      content: imageBase64 ? (msg || "Analyze this image for pest or farming issues.") : msg,
      image: imageBase64,
    };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);
    onCaptionChange("");
    onSubtitleChange(imageBase64 ? "Analyzing photo..." : `"${msg}"`);

    const weatherContext = weather
      ? `\n[Current weather at ${weather.locationName}: ${weather.description}, ${weather.temperature}°C, humidity ${weather.humidity}%, wind ${weather.windSpeed} km/h]`
      : "";

    const nameContext = userName ? `\n[Farmer's name: ${userName}]` : "";

    const contextMessages = allMessages.map((m, i) => {
      const base: any = { role: m.role, content: m.content };
      if (m.image) base.image = m.image;
      if (i === 0 && m.role === "user") {
        base.content = `[Farmer speaking]${nameContext}${weatherContext} ${m.content}`;
      }
      return base;
    });

    try {
      const isOffline = !navigator.onLine;
      if (isOffline) {
        const cached = await getCache("chat", "last_response");
        if (cached) {
          onCaptionChange(`[Offline] ${cached}`);
          enqueueTTSChunk(cached);
          setMessages(prev => [...prev, { role: "assistant", content: cached }]);
          setIsLoading(false);
          return;
        }
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: contextMessages, sessionId: sessionIdRef.current, channel: "web", userName: userName || undefined, farmPlans: farmPlans.length > 0 ? farmPlans : undefined, lang: currentLang === "zu" ? "zu" : "en-ZA" }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Something went wrong" }));
        const errText = err.error || "Even my circuits are confused. Try again?";
        speak(errText);
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let ttsBuffer = "";
      const toolCalls: Record<number, { name: string; args: string }> = {};

      startStreamingTTS();
      setIsSpeaking(true);
      onSubtitleChange("");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta;
            const content = delta?.content;
            
            // Handle tool calls
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCalls[idx]) toolCalls[idx] = { name: "", args: "" };
                if (tc.function?.name) toolCalls[idx].name = tc.function.name;
                if (tc.function?.arguments) toolCalls[idx].args += tc.function.arguments;
              }
            }
            
            if (content) {
              assistantText += content;
              ttsBuffer += content;
              onCaptionChange(assistantText);

              const sentenceMatch = ttsBuffer.match(/^([\s\S]*?[.!?…]\s)/);
              if (sentenceMatch) {
                const sentence = sentenceMatch[1];
                ttsBuffer = ttsBuffer.slice(sentence.length);
                currentSentimentRef.current = detectSentiment(sentence);
                enqueueTTSChunk(sentence);
              }
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Handle tool calls
      for (const tc of Object.values(toolCalls)) {
        if (tc.name === "create_farm_plan" && tc.args) {
          try {
            const args = JSON.parse(tc.args);
            if (args.tasks && Array.isArray(args.tasks)) {
              await saveFarmPlans(args.tasks);
              if (!assistantText) {
                assistantText = `Sharp sharp, I've set up a farming calendar with ${args.tasks.length} tasks for you. I'll check in on your progress — no slacking, nè?`;
                onCaptionChange(assistantText);
                enqueueTTSChunk(assistantText);
              }
            }
          } catch (e) {
            console.error("Failed to parse farm plan tool call:", e);
          }
        }
        if (tc.name === "recommend_products" && tc.args) {
          try {
            const args = JSON.parse(tc.args);
            if (args.products && Array.isArray(args.products)) {
              onProductsChange?.(args.products);
            }
          } catch (e) {
            console.error("Failed to parse products tool call:", e);
          }
        }
        if (tc.name === "predict_market" && tc.args) {
          try {
            const args = JSON.parse(tc.args);
            if (args.predictions && Array.isArray(args.predictions)) {
              onMarketPredictions?.(args.predictions);
            }
          } catch (e) {
            console.error("Failed to parse market prediction tool call:", e);
          }
        }
        if (tc.name === "fetch_live_prices" && tc.args) {
          try {
            const args = JSON.parse(tc.args);
            console.log("Fetching live market prices via Firecrawl...", args.crops);
            onMarketLoading?.(true);
            const { supabase } = await import("@/integrations/supabase/client");
            const { data: priceData, error: priceErr } = await (supabase as any).functions.invoke("market-prices", {
              body: { crops: args.crops },
            });
            if (!priceErr && priceData?.prices) {
              console.log(`Got ${priceData.prices.length} live prices`);
              // Show live prices as market predictions with "LIVE" tag
              const livePredictions = priceData.prices.slice(0, 8).map((p: any) => ({
                item: p.crop,
                current_price: p.price_min === p.price_max
                  ? `R${p.price_min}/${p.unit}`
                  : `R${p.price_min}-R${p.price_max}/${p.unit}`,
                predicted_trend: "stable" as const,
                demand_level: "medium" as const,
                best_sell_window: `Live from ${p.source}`,
                tip: `Scraped ${priceData.scraped_at?.split("T")[0] || "today"}`,
                confidence: "high" as const,
              }));
              if (livePredictions.length > 0) {
                onMarketPredictions?.(livePredictions);
                if (!assistantText) {
                  assistantText = `Sharp sharp, I pulled live prices from ${priceData.sources_scraped} South African markets. Here's what the real numbers look like right now.`;
                  onCaptionChange(assistantText);
                  enqueueTTSChunk(assistantText);
                }
              }
            } else {
              console.warn("Live prices fetch failed:", priceErr);
            }
          } catch (e) {
            console.error("Failed to fetch live prices:", e);
          } finally {
            onMarketLoading?.(false);
          }
        }
        if (tc.name === "biosecurity_check" && tc.args) {
          try {
            onBioLoading?.(true);
            const args = JSON.parse(tc.args);
            if (args.livestock_type && args.checklist) {
              onBiosecurityData?.(args as BiosecurityData);
            }
          } catch (e) {
            console.error("Failed to parse biosecurity tool call:", e);
          } finally {
            onBioLoading?.(false);
          }
        }
      }

      setMessages(prev => [...prev, { role: "assistant", content: assistantText }]);
      if (assistantText) {
        currentSentimentRef.current = detectSentiment(assistantText);
        finishStreamingTTS(ttsBuffer);
        // Fetch log ID for feedback
        const fetchLogId = async (retries = 3) => {
          for (let i = 0; i < retries; i++) {
            await new Promise(r => setTimeout(r, 1500));
            try {
              const { supabase } = await import("@/integrations/supabase/client");
              const { data } = await (supabase as any)
                .from("conversation_logs")
                .select("id")
                .eq("session_id", sessionIdRef.current)
                .order("created_at", { ascending: false })
                .limit(1);
              if (data?.[0]?.id) {
                onLastLogIdChange?.(data[0].id);
                return;
              }
            } catch {}
          }
        };
        fetchLogId();
      }
    } catch {
      speak("Something went wrong — try again.");
    }
    setIsLoading(false);
  }, [input, isLoading, messages, farmPlans, weather, userName, speak, startStreamingTTS, enqueueTTSChunk, finishStreamingTTS, detectSentiment, saveFarmPlans, onCaptionChange, onSubtitleChange, onLastLogIdChange]);

  const handleImageCapture = useCallback((base64: string) => {
    closeLiveCamera();
    sendChat("Please analyze this image. Identify any pests, diseases, or farming issues.", base64);
  }, [closeLiveCamera, sendChat]);

  const handleYesNo = useCallback((isYes: boolean) => {
    stopListening();
    setShowButtons(false);
    if (isYes) {
      setOnboardingStep("ask-location");
    } else {
      // Skip tour, go straight to chat
      goToChat();
    }
  }, [stopListening, goToChat]);

  const handleNameSubmit = useCallback((name: string) => {
    const cleanName = name.trim().split(" ")[0];
    if (!cleanName) return;
    stopListening();
    setUserName(cleanName);
    localStorage.setItem("agri_user_name", cleanName);
    setShowButtons(false);
    setNameInput("");
    setOnboardingStep("greeting");
  }, [stopListening]);

  // Send farm SMS (weather, calendar, gcal link)
  const sendFarmSms = useCallback(async (phone: string, type: "welcome" | "weather-alert" | "farm-plan", extraWeather?: any) => {
    try {
      const weatherData = extraWeather || (weather ? {
        description: weather.description,
        temperature: weather.temperature,
        locationName: weather.locationName,
        windSpeed: weather.windSpeed,
        humidity: weather.humidity,
      } : undefined);

      await fetch(SMS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          phone,
          type,
          weather: weatherData,
          farmPlans: farmPlans.length > 0 ? farmPlans : undefined,
          farmerName: userName || undefined,
          location: weather?.locationName || undefined,
        }),
      });
    } catch (e) {
      console.error("Failed to send farm SMS:", e);
    }
  }, [weather, farmPlans, userName]);

  const handlePhoneSubmit = useCallback((phone: string) => {
    const cleaned = phone.replace(/\s/g, "");
    if (cleaned.length < 10) return;
    setShowButtons(false);
    setFarmerPhone(cleaned);
    setPhoneInput("");
    localStorage.setItem("abuti_phone", cleaned);

    // Save to farmers table
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: existing } = await (supabase as any).from("farmers").select("id").eq("phone", cleaned).limit(1);
        if (existing && existing.length > 0) {
          await (supabase as any).from("farmers").update({ name: userName || "Farmer", last_login: new Date().toISOString() }).eq("id", existing[0].id);
        } else {
          await (supabase as any).from("farmers").insert({ name: userName || "Farmer", phone: cleaned, last_login: new Date().toISOString() });
        }
      } catch {}
    })();

    // Send welcome SMS
    sendFarmSms(cleaned, "welcome");

    speak(currentLang === "zu" ? "Siyabonga! Ngizokuthumela i-SMS." : "Nice! I'll send you updates via SMS.", () => {
      setOnboardingStep("tour-done");
    });
  }, [userName, sendFarmSms, speak, currentLang]);

  const handleLocationChoice = useCallback((share: boolean) => {
    setShowButtons(false);
    if (share) {
      onRequestLocation?.();
      speak("Checking your location... one moment.", () => {});
    } else {
      speak("No worries — I can still help without knowing exactly where you are. You can always share later.", () => {
        setOnboardingStep("tour-intro");
      });
    }
  }, [onRequestLocation, speak]);

  const handleNext = useCallback(() => {
    setShowButtons(false);
    const tourIndex = TOUR_STEPS.indexOf(onboardingStep);
    if (tourIndex >= 0 && tourIndex < TOUR_STEPS.length - 1) {
      setOnboardingStep(TOUR_STEPS[tourIndex + 1]);
    } else {
      stopSpeaking();
      goToChat();
    }
  }, [onboardingStep, stopSpeaking, goToChat]);

  const handleSkip = useCallback(() => {
    stopSpeaking();
    setShowButtons(false);
    goToChat();
  }, [stopSpeaking, goToChat]);

  // Progress dots
  const tourIndex = TOUR_STEPS.indexOf(onboardingStep);
  const showProgress = phase === "onboarding" && tourIndex >= 0;

  // Tour step icons & labels
  const STEP_META: Record<string, { icon: typeof Mic; label: string; color: string }> = {
    "tour-intro": { icon: Sparkles, label: "Welcome", color: "hsl(130, 45%, 45%)" },
    "tour-voice": { icon: Mic, label: "Voice", color: "hsl(200, 60%, 50%)" },
    "tour-camera": { icon: Camera, label: "Camera", color: "hsl(280, 50%, 55%)" },
    "tour-weather": { icon: Cloud, label: "Weather", color: "hsl(45, 80%, 50%)" },
    "tour-market": { icon: TrendingUp, label: "Markets", color: "hsl(160, 55%, 42%)" },
    "tour-biosecurity": { icon: Shield, label: "Biosecurity", color: "hsl(350, 60%, 50%)" },
    "tour-accessibility": { icon: Accessibility, label: "Access", color: "hsl(220, 55%, 55%)" },
    "tour-offline": { icon: Wifi, label: "Offline", color: "hsl(30, 65%, 50%)" },
    "ask-phone": { icon: Phone, label: "Phone", color: "hsl(170, 50%, 45%)" },
    "tour-done": { icon: Rocket, label: "Ready!", color: "hsl(130, 50%, 48%)" },
  };

  const currentMeta = STEP_META[onboardingStep];
  const CurrentStepIcon = currentMeta?.icon || Leaf;

  return (
    <div className="relative w-full">
      {/* Camera overlay — abuti stays conversational while it's open */}
      {showCamera && (
        <CameraCapture
          onCapture={handleImageCapture}
          onClose={closeLiveCamera}
          initialStream={cameraStream}
          initialError={cameraError}
          isSpeaking={isSpeaking}
          onVoiceQuery={(transcript) => {
            const lower = transcript.toLowerCase();
            if (CAMERA_TRIGGERS.some(t => lower.includes(t)) && lower.length < 30) return;
            sendChat(`[While viewing crop through camera] ${transcript}`);
          }}
          onFaceUpdate={(f) => {
            // Reflect what the orb "sees" in its emotion
            if (f.faceCount === 0) {
              onEmotionChange("curious");
              return;
            }
            if (f.expression === "happy") onEmotionChange("happy");
            else if (f.expression === "surprised") onEmotionChange("excited");
            else if (f.expression === "sad") onEmotionChange("worried");
            else if (f.expression === "angry") onEmotionChange("thinking");
            else if (f.expression === "sleepy") onEmotionChange("sleepy");
            else onEmotionChange("listening");

            // Update subtitle so the user knows what abuti perceives
            const who = f.faceCount > 1 ? `${f.faceCount} people — I'm watching the closest one` : "I can see you";
            onSubtitleChange(`${who} · looks ${f.expression}`);

            // Greet / react on meaningful changes (throttled by the tracker's `changed` flag)
            if (f.changed && !isSpeaking) {
              if (f.expression === "happy") sendChat("[Face detected — the user just smiled. Greet them warmly with a short, playful line.]");
              else if (f.expression === "sad") sendChat("[Face detected — the user looks sad. Ask gently what's wrong in one short sentence.]");
              else if (f.expression === "surprised") sendChat("[Face detected — the user looks surprised. React with a short, curious remark.]");
            }
          }}
        />
      )}

      <div className="flex flex-col items-center gap-3 w-full" style={{ maxWidth: 320 }}>

        {/* ── TOUR STEP CARD (glassmorphic, with icon & label) ── */}
        {showProgress && currentMeta && (
          <div style={{
            width: "100%", padding: "14px 18px", borderRadius: 20,
            background: "hsla(0, 0%, 100%, 0.65)",
            backdropFilter: "blur(30px) saturate(1.4)",
            WebkitBackdropFilter: "blur(30px) saturate(1.4)",
            border: "1px solid hsla(0, 0%, 100%, 0.55)",
            boxShadow: "0 4px 24px hsla(130, 30%, 30%, 0.06), 0 1px 3px hsla(0,0%,0%,0.03)",
            animation: "onboardCardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            {/* Step header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: `${currentMeta.color}15`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.4s ease",
              }}>
                <CurrentStepIcon size={16} style={{ color: currentMeta.color }} strokeWidth={2} />
              </div>
              <div>
                <span style={{
                  fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em",
                  textTransform: "uppercase" as const, color: currentMeta.color,
                  fontFamily: FONT,
                }}>
                  Step {tourIndex + 1} of {TOUR_STEPS.length}
                </span>
                <p style={{
                  fontSize: 13, fontWeight: 600, color: "hsl(0, 0%, 18%)",
                  margin: 0, fontFamily: FONT, lineHeight: 1.2,
                }}>
                  {currentMeta.label}
                </p>
              </div>
            </div>

            {/* Step icon row (mini progress) */}
            <div style={{
              display: "flex", gap: 4, justifyContent: "center", padding: "6px 0 2px",
            }}>
              {TOUR_STEPS.map((step, i) => {
                const meta = STEP_META[step];
                const StepIcon = meta?.icon || Leaf;
                const isActive = i === tourIndex;
                const isDone = i < tourIndex;
                return (
                  <div key={step} style={{
                    width: isActive ? 28 : 22, height: isActive ? 28 : 22,
                    borderRadius: isActive ? 9 : 7,
                    background: isActive
                      ? `${meta?.color || "hsl(130,40%,48%)"}18`
                      : isDone
                        ? `${meta?.color || "hsl(130,40%,48%)"}10`
                        : "hsla(0, 0%, 0%, 0.03)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                    border: isActive ? `1.5px solid ${meta?.color || "hsl(130,40%,48%)"}40` : "1.5px solid transparent",
                  }}>
                    <StepIcon
                      size={isActive ? 13 : 10}
                      strokeWidth={isActive ? 2.2 : 1.8}
                      style={{
                        color: isActive
                          ? (meta?.color || "hsl(130,40%,48%)")
                          : isDone
                            ? (meta?.color || "hsl(130,40%,48%)")
                            : "hsla(0,0%,0%,0.18)",
                        opacity: isDone ? 0.6 : 1,
                        transition: "all 0.3s ease",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Language selection */}
        {showButtons && buttonType === "lang-select" && (
          <div style={{
            display: "flex", flexDirection: "column", gap: 14, alignItems: "center",
            animation: "onboardCardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
            width: "100%",
          }}>
            <div style={{
              width: "100%", padding: "20px 18px", borderRadius: 20,
              background: "hsla(0, 0%, 100%, 0.65)",
              backdropFilter: "blur(30px) saturate(1.4)",
              WebkitBackdropFilter: "blur(30px) saturate(1.4)",
              border: "1px solid hsla(0, 0%, 100%, 0.55)",
              boxShadow: "0 4px 24px hsla(130, 30%, 30%, 0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: "hsla(130, 40%, 48%, 0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Globe size={16} style={{ color: "hsl(130, 40%, 45%)" }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "hsl(0, 0%, 18%)", fontFamily: FONT, margin: 0 }}>
                  Choose your language
                </p>
              </div>
              <p style={{ fontSize: 12, color: "hsl(0,0%,45%)", fontFamily: FONT, margin: "0 0 14px", textAlign: "center" }}>
                Khetha ulimi lwakho
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { code: "en-ZA", label: "🇬🇧  English", sub: "English" },
                  { code: "zu", label: "🇿🇦  IsiZulu", sub: "Zulu" },
                ].map(l => (
                  <button key={l.code} onClick={() => { setLang(l.code); localStorage.setItem("abuti_lang", l.code); setShowButtons(false); setOnboardingStep("ask-name"); }} style={{
                    flex: 1, padding: "14px 12px", borderRadius: 16, border: "none",
                    background: "linear-gradient(135deg, hsl(130, 40%, 48%), hsl(142, 38%, 42%))",
                    color: "hsl(0, 0%, 100%)",
                    fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                    boxShadow: "0 4px 18px hsla(135, 35%, 40%, 0.25)",
                    letterSpacing: "0.02em", transition: "all 0.2s ease",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Yes/No buttons */}
        {showButtons && buttonType === "yesno" && (
          <div style={{
            display: "flex", gap: 10, width: "100%",
            animation: "onboardCardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            <button onClick={() => handleYesNo(true)} style={{
              flex: 1, padding: "14px 16px", borderRadius: 16, border: "none",
              background: "linear-gradient(135deg, hsl(130, 40%, 48%), hsl(142, 38%, 42%))",
              color: "hsl(0, 0%, 100%)",
              fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
              boxShadow: "0 4px 18px hsla(135, 35%, 40%, 0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <Leaf size={14} /> Let's do it!
            </button>
            <button onClick={() => handleYesNo(false)} style={{
              flex: 1, padding: "14px 16px", borderRadius: 16,
              border: "1px solid hsla(130, 20%, 60%, 0.15)",
              background: "hsla(0, 0%, 100%, 0.65)", color: "hsl(0, 0%, 32%)",
              fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: FONT,
              backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <ChevronRight size={14} /> Skip tour
            </button>
          </div>
        )}

        {/* Name input */}
        {showButtons && buttonType === "name-input" && (
          <div style={{
            width: "100%", animation: "onboardCardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            <div style={{
              width: "100%", padding: "16px 16px", borderRadius: 20,
              background: "hsla(0, 0%, 100%, 0.65)",
              backdropFilter: "blur(30px) saturate(1.4)",
              WebkitBackdropFilter: "blur(30px) saturate(1.4)",
              border: "1px solid hsla(0, 0%, 100%, 0.55)",
              boxShadow: "0 4px 24px hsla(130, 30%, 30%, 0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: "hsla(130, 40%, 48%, 0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <User size={14} style={{ color: "hsl(130, 40%, 45%)" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "hsl(0,0%,35%)", fontFamily: FONT }}>
                  What's your name?
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  ref={nameInputRef}
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleNameSubmit(nameInput)}
                  placeholder="Your name…"
                  style={{
                    flex: 1, padding: "12px 16px", borderRadius: 14,
                    border: "1.5px solid hsla(130, 30%, 60%, 0.15)",
                    background: "hsla(0, 0%, 100%, 0.7)",
                    fontSize: 14, fontFamily: FONT, outline: "none",
                    color: "hsl(0, 0%, 18%)",
                    transition: "border-color 0.3s ease",
                  }}
                  onFocus={e => e.target.style.borderColor = "hsla(130, 40%, 48%, 0.4)"}
                  onBlur={e => e.target.style.borderColor = "hsla(130, 30%, 60%, 0.15)"}
                />
                <button
                  onClick={() => handleNameSubmit(nameInput)}
                  disabled={!nameInput.trim()}
                  style={{
                    width: 44, height: 44, borderRadius: 14, border: "none",
                    background: nameInput.trim()
                      ? "linear-gradient(135deg, hsl(130, 40%, 48%), hsl(142, 38%, 42%))"
                      : "hsl(0, 0%, 92%)",
                    color: "hsl(0, 0%, 100%)", fontSize: 16, cursor: nameInput.trim() ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: nameInput.trim() ? "0 3px 12px hsla(135, 35%, 40%, 0.25)" : "none",
                    transition: "all 0.3s ease",
                  }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Phone input */}
        {showButtons && buttonType === "phone-input" && (
          <div style={{
            width: "100%", animation: "onboardCardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            <div style={{
              width: "100%", padding: "16px 16px", borderRadius: 20,
              background: "hsla(0, 0%, 100%, 0.65)",
              backdropFilter: "blur(30px) saturate(1.4)",
              WebkitBackdropFilter: "blur(30px) saturate(1.4)",
              border: "1px solid hsla(0, 0%, 100%, 0.55)",
              boxShadow: "0 4px 24px hsla(130, 30%, 30%, 0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: "hsla(170, 50%, 45%, 0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Phone size={14} style={{ color: "hsl(170, 50%, 45%)" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "hsl(0,0%,35%)", fontFamily: FONT }}>
                  Get SMS alerts
                </span>
              </div>
              <p style={{ fontSize: 11, color: "hsl(0,0%,50%)", fontFamily: FONT, margin: "0 0 10px", lineHeight: 1.5 }}>
                Weather warnings, market alerts & your planting calendar
              </p>
              <div className="flex gap-2">
                <input
                  ref={phoneInputRef}
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handlePhoneSubmit(phoneInput)}
                  placeholder="+27 812 345 678"
                  type="tel"
                  style={{
                    flex: 1, padding: "12px 16px", borderRadius: 14,
                    border: "1.5px solid hsla(170, 30%, 60%, 0.15)",
                    background: "hsla(0, 0%, 100%, 0.7)",
                    fontSize: 14, fontFamily: FONT, outline: "none",
                    color: "hsl(0, 0%, 18%)", letterSpacing: "0.04em",
                    transition: "border-color 0.3s ease",
                  }}
                  onFocus={e => e.target.style.borderColor = "hsla(170, 50%, 45%, 0.4)"}
                  onBlur={e => e.target.style.borderColor = "hsla(170, 30%, 60%, 0.15)"}
                />
                <button
                  onClick={() => handlePhoneSubmit(phoneInput)}
                  disabled={phoneInput.replace(/\s/g, "").length < 10}
                  style={{
                    width: 44, height: 44, borderRadius: 14, border: "none",
                    background: phoneInput.replace(/\s/g, "").length >= 10
                      ? "linear-gradient(135deg, hsl(170, 50%, 45%), hsl(150, 45%, 42%))"
                      : "hsl(0, 0%, 92%)",
                    color: "hsl(0, 0%, 100%)", cursor: phoneInput.replace(/\s/g, "").length >= 10 ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: phoneInput.replace(/\s/g, "").length >= 10 ? "0 3px 12px hsla(170, 45%, 40%, 0.25)" : "none",
                    transition: "all 0.3s ease",
                  }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <button onClick={() => { setShowButtons(false); setOnboardingStep("tour-done"); }} style={{
                background: "none", border: "none", fontSize: 11, color: "hsl(0, 0%, 50%)",
                cursor: "pointer", fontFamily: FONT, opacity: 0.5, marginTop: 8,
                width: "100%", textAlign: "center",
              }}>
                {currentLang === "zu" ? "Yeqa" : "Skip for now"}
              </button>
            </div>
          </div>
        )}

        {/* Location buttons */}
        {showButtons && buttonType === "location" && (
          <div style={{
            display: "flex", gap: 10, width: "100%",
            animation: "onboardCardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            <button onClick={() => handleLocationChoice(true)} style={{
              flex: 1, padding: "14px 16px", borderRadius: 16, border: "none",
              background: "linear-gradient(135deg, hsl(130, 40%, 48%), hsl(142, 38%, 42%))",
              color: "hsl(0, 0%, 100%)",
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
              boxShadow: "0 4px 18px hsla(135, 35%, 40%, 0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <MapPin size={14} /> Share location
            </button>
            <button onClick={() => handleLocationChoice(false)} style={{
              padding: "14px 20px", borderRadius: 16,
              border: "1px solid hsla(130, 20%, 60%, 0.15)",
              background: "hsla(0, 0%, 100%, 0.65)", color: "hsl(0, 0%, 32%)",
              fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: FONT,
              backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            }}>
              Skip
            </button>
          </div>
        )}

        {/* Next/Go buttons */}
        {showButtons && (buttonType === "next" || buttonType === "go") && (
          <div style={{
            display: "flex", gap: 10, alignItems: "center", width: "100%",
            animation: "onboardCardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            <button onClick={handleNext} style={{
              flex: 1, padding: "14px 24px", borderRadius: 16, border: "none",
              background: buttonType === "go"
                ? "linear-gradient(135deg, hsl(130, 50%, 45%), hsl(160, 45%, 40%))"
                : "linear-gradient(135deg, hsl(130, 40%, 48%), hsl(142, 38%, 42%))",
              color: "hsl(0, 0%, 100%)",
              fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
              boxShadow: "0 4px 18px hsla(135, 35%, 40%, 0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all 0.2s ease",
            }}>
              {buttonType === "go" ? (
                <><Rocket size={15} /> Let's grow!</>
              ) : (
                <>Next <ChevronRight size={15} /></>
              )}
            </button>
            {buttonType === "next" && (
              <button onClick={handleSkip} style={{
                padding: "12px 16px", borderRadius: 14, border: "none",
                background: "hsla(0, 0%, 100%, 0.45)",
                backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                color: "hsl(0, 0%, 45%)",
                fontSize: 12, cursor: "pointer", fontFamily: FONT,
                transition: "all 0.2s ease",
              }}>
                Skip tour
              </button>
            )}
          </div>
        )}

        {phase === "idle" && (
          <div style={{
            width: "100%", maxWidth: 320, padding: "14px 18px", borderRadius: 22,
            background: "hsla(0, 0%, 100%, 0.7)", backdropFilter: "blur(30px) saturate(1.25)",
            WebkitBackdropFilter: "blur(30px) saturate(1.25)", border: "1px solid hsla(0, 0%, 100%, 0.65)",
            boxShadow: "0 10px 30px hsla(0, 0%, 0%, 0.08)",
            textAlign: "center",
          }}>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "hsl(0, 0%, 36%)", fontFamily: FONT }}>
              Tap the orb above to begin. Once chat is active, say "Orb" anytime, type a question, or scan a plant.
            </p>
          </div>
        )}

        {/* Chat controls */}
        {phase === "chat" && (
          <div className="flex flex-col items-center gap-3" style={{ animation: "fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "hsl(0, 0%, 45%)", fontFamily: FONT, textAlign: "center", maxWidth: 280 }}>
                Tap the orb or say "Orb" to speak. Type below or scan a plant to get help fast.
              </span>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <button
                  onClick={openLiveCamera}
                  disabled={isLoading}
                  aria-label="Scan plant with camera"
                  style={{
                    width: 46, height: 46, borderRadius: "50%", border: "none",
                    background: "hsla(0, 0%, 100%, 0.6)",
                    backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                    cursor: isLoading ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 2px 14px hsla(0, 0%, 0%, 0.06), 0 1px 2px hsla(0, 0%, 0%, 0.04)",
                    transition: "all 0.3s ease",
                  }}
                >
                  <Camera size={20} style={{ color: isLoading ? "hsl(0, 0%, 65%)" : "hsl(135, 35%, 40%)" }} />
                </button>

                {isSpeaking && (
                  <button onClick={stopSpeaking} aria-label="Stop speech" style={{
                    width: 46, height: 46, borderRadius: "50%", border: "none",
                    background: "hsla(0, 0%, 100%, 0.6)",
                    backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 2px 14px hsla(0, 0%, 0%, 0.06), 0 1px 2px hsla(0, 0%, 0%, 0.04)",
                    animation: "speakerPulse 1.5s ease-in-out infinite",
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(130, 30%, 45%)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <line x1="23" y1="9" x2="17" y2="15"/>
                      <line x1="17" y1="9" x2="23" y2="15"/>
                    </svg>
                  </button>
                )}
              </div>

              {!showTextInput ? (
                <button onClick={() => { setShowTextInput(true); setTimeout(() => inputRef.current?.focus(), 100); }} style={{
                  background: "none", border: "none", fontSize: 11, color: "hsl(0, 0%, 50%)",
                  cursor: "pointer", fontFamily: FONT, opacity: 0.55,
                  letterSpacing: "0.04em",
                  transition: "opacity 0.2s ease",
                }}>
                  Type a question
                </button>
              ) : (
                <div className="flex gap-2 w-full" style={{ maxWidth: 300, animation: "fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendChat()}
                    placeholder="Type your question…"
                    style={{
                      flex: 1, padding: "12px 18px", borderRadius: 24,
                      border: "1px solid hsla(130, 20%, 60%, 0.12)",
                      background: "hsla(0, 0%, 100%, 0.65)",
                      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                      fontSize: 13.5, fontFamily: FONT, outline: "none",
                      color: "hsl(0, 0%, 18%)",
                      boxShadow: "0 2px 12px hsla(0, 0%, 0%, 0.04)",
                      transition: "border-color 0.3s ease, box-shadow 0.3s ease",
                      letterSpacing: "0.01em",
                    }}
                  />
                  <button
                    onClick={() => sendChat()}
                    disabled={!input.trim() || isLoading}
                    style={{
                      width: 42, height: 42, borderRadius: "50%", border: "none",
                      background: input.trim() && !isLoading
                        ? "linear-gradient(135deg, hsl(130, 40%, 48%), hsl(142, 38%, 42%))"
                        : "hsl(0, 0%, 90%)",
                      color: "hsl(0, 0%, 100%)", fontSize: 15, cursor: input.trim() ? "pointer" : "default",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: input.trim() && !isLoading ? "0 3px 12px hsla(135, 35%, 40%, 0.25)" : "none",
                      transition: "all 0.3s ease",
                    }}
                  >
                    ↑
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { OrbController };
export type { Phase };
