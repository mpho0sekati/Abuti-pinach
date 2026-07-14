import { useState, useCallback, useEffect } from "react";

export type Language = "en" | "zu";

const translations = {
  en: {
    tools: "Tools",
    market: "Market",
    autoAssist: "Auto-assist",
    myArea: "My area",
    myRules: "My rules",
    deals: "Deals",
    checkRain: "Check rain this week",
    todayMaizePrice: "Ask about today's maize price",
    offline: "You're offline",
    askOrb: "Tap the orb or say \"Orb\"",
  },
  zu: {
    tools: "Amathuluzi",
    market: "Imakethe",
    autoAssist: "Ukusiza",
    myArea: "Indawo yami",
    myRules: "Imithetho yami",
    deals: "Amadili",
    checkRain: "Bheka imvula kuleli viki",
    todayMaizePrice: "Buza ngentengo yombila namuhla",
    offline: "Awuxhunyiwe",
    askOrb: "Thinta i-orb noma usho ukuthi \"Orb\"",
  },
};

export function useI18n() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem("abuti_lang");
    return (saved === "zu" || saved === "zu-ZA") ? "zu" : "en";
  });

  const t = useCallback((key: keyof typeof translations.en) => {
    return translations[lang][key] || translations.en[key];
  }, [lang]);

  const toggleLanguage = useCallback(() => {
    const next = lang === "en" ? "zu" : "en";
    setLang(next);
    localStorage.setItem("abuti_lang", next);
  }, [lang]);

  return { lang, t, toggleLanguage, setLang };
}
