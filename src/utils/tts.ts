/**
 * Shared browser TTS utility optimised for a natural South African English voice.
 * Centralises voice selection so every component sounds consistent.
 */

let cachedVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;

// Preferred voices ranked by quality for SA English (tested across browsers)
const PREFERRED_VOICES = [
  // Google / Chrome high-quality
  "google uk english male",
  "google us english",
  // macOS / iOS
  "daniel",       // British Daniel – warm, natural
  "tessa",        // SA English on Apple devices
  "rishi",        // Indian English – closer cadence to SA
  // Windows
  "microsoft ryan",
  "microsoft george",
  // Generic fallbacks
  "male",
];

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  const lang = v.lang.toLowerCase();

  // Exact SA English match is best
  if (lang === "en-za") return 100;

  // Check preferred list
  for (let i = 0; i < PREFERRED_VOICES.length; i++) {
    if (name.includes(PREFERRED_VOICES[i])) return 80 - i;
  }

  // British English is closer to SA cadence than American
  if (lang === "en-gb") return 30;
  if (lang.startsWith("en-")) return 20;
  if (lang.startsWith("en")) return 10;

  return 0;
}

export function getBestVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice && voicesLoaded) return cachedVoice;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  voicesLoaded = true;

  // Score and pick the best
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;

  for (const v of voices) {
    const s = scoreVoice(v);
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }

  cachedVoice = best;
  return best;
}

// Preload voices (some browsers need this)
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.getVoices(); // trigger load
  window.speechSynthesis.onvoiceschanged = () => {
    voicesLoaded = false;
    cachedVoice = null;
    getBestVoice();
  };
}

/**
 * Clean text for TTS – strip markdown, emoji, etc.
 */
export function cleanForTTS(text: string): string {
  return text
    .replace(/[*_`#\[\]()]/g, "")
    .replace(/\n+/g, ". ")
    .replace(/[\u{1F600}-\u{1F9FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Create a pre-configured utterance with optimal SA English settings.
 */
export function createUtterance(text: string): SpeechSynthesisUtterance {
  const clean = cleanForTTS(text);
  const utterance = new SpeechSynthesisUtterance(clean);

  // Tuned for natural conversational SA English
  utterance.rate = 0.95;   // slightly slower than default for clarity
  utterance.pitch = 0.9;   // slightly deeper, more natural male tone
  utterance.volume = 1.0;
  utterance.lang = "en-ZA";

  const voice = getBestVoice();
  if (voice) utterance.voice = voice;

  return utterance;
}
