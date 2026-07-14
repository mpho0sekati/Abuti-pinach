# AbUti Spinach — Precision Agriculture Intelligence Platform

> The most advanced AI-powered agriculture system for African smallholder farmers. Combining GeoAI, satellite intelligence, conversational AI agents, and precision farming — accessible from any device, any channel.

**[Live Demo →](https://abutispinach.lovable.app)**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

---

## Vision

**Build the Palantir of agriculture** — a unified intelligence platform where every farmer, regardless of literacy, connectivity, or resources, has access to the same caliber of data-driven decision-making used by industrial-scale operations. AbUti Spinach democratizes precision farming through an AI-first, voice-first, orb-centric interface that works on web, SMS, USSD, and voice calls.

---

## What We Have Built

### 1. The Green Orb — Your Central Intelligence Hub

The animated AI avatar **is** the app. Everything orbits around it — there are no separate pages or tabs. Four glassmorphic orbital buttons float around the orb, each opening a slide-up drawer with the relevant feature.

```
         [Agents]
            \
  [Rules] — 🟢 — [GeoAI]
            /
         [Deals]
```

- **12 emotional states** with eye tracking, micro-expressions, and mouth animation synced to speech
- **Voice-first interaction** — speak naturally, hear responses via browser-native TTS. Say "Orb" to wake it
- **Image understanding** — snap a photo of a diseased plant, the orb identifies the issue and recommends treatment
- **Context-aware** — the orb knows which drawer is open (Agents, GeoAI, Deals, Permissions) and can discuss that data in real time
- **Mini Orb guide** — a smaller companion orb is always available, offering suggestions and executing actions on your behalf via conversation
- **No navigation needed** — tap an orbital button, a drawer slides up from the bottom. The GeoAI map fills 95% of the screen. Close by swiping down.

**Tech:** Google Gemini (Flash/Pro) via Lovable AI Gateway, Web Speech API (STT + TTS), Canvas animations, vaul (bottom drawers)

### 2. GeoAI — Precision Farming GIS Powerhouse

A full geographic intelligence system for field-level decision making.

#### Satellite NDVI Vegetation Mapping
- **Real NASA MODIS Terra NDVI** 8-day composite tiles from NASA GIBS (not simulated data)
- Toggleable NDVI overlay on top of satellite/street/terrain base layers
- Adjustable transparency slider (0-100%) for comparing vegetation density against underlying imagery
- Continuous RGB interpolation (Deep Red → Orange → Yellow → Forest Green) for professional false-color rendering

#### Farm Boundary Mapping
- **Walk-around GPS tracking** — walk the perimeter of your farm with your phone, the system records your path and closes the boundary automatically
- **Manual point placement** — tap the map to mark corners of your field
- Boundary area calculation with hectare display

#### Automated Feature Detection
- **Building detection** via OpenStreetMap Overpass API — identifies structures within your farm boundary (rendered as orange polygons)
- **Water source detection** — wells, streams, rivers, reservoirs identified and displayed as blue features with descriptive popups
- Toggle buildings and water features independently

#### Smart Irrigation Planning
- **ET₀-based irrigation scheduling** using FAO Penman-Monteith reference evapotranspiration from NASA POWER satellite data
- Daily water requirement estimates in mm/day based on actual satellite-measured climate variables
- Crop-specific Kc coefficient adjustments

#### Crop Suitability & Yield Prediction
- **Growing Degree Days (GDD)** calculated from NASA POWER temperature data for your exact GPS coordinates
- Crop suitability scoring based on local climate, rainfall patterns, and temperature ranges
- Expected yield estimates per hectare for recommended crops
- Soil moisture estimation from satellite-derived data

#### Field Health Monitoring
- Composite field health score combining NDVI, soil moisture, temperature stress, and pest risk
- Visual health indicator with actionable recommendations
- The orb explains findings as a professional agronomist would — in plain language via voice or text

**Data Sources:** NASA GIBS (MODIS Terra NDVI), NASA POWER (climate/radiation), Open-Meteo (weather), OpenStreetMap Overpass (infrastructure)

### 3. Abuti Agent Crew — Autonomous AI Agents

A team of specialized AI agents that work on the farmer's behalf, powered by Google Gemini.

| Agent | Role | What It Does |
|-------|------|-------------|
| Market Analyst | Price intelligence | Scans market conditions, finds best prices for your crops |
| Quality Inspector | Produce grading | Assesses crop quality, recommends optimal harvest timing |
| Negotiator | Deal making | Negotiates prices with buyers within your set parameters |
| Logistics Coordinator | Transport | Arranges transport and tracks delivery of sold produce |
| Risk Assessor | Risk management | Evaluates deal risks, weather threats, market volatility |

- **Permission-based autonomy** — farmers set boundaries (minimum price, max deal value, allowed crops) and agents operate within those guardrails
- **Deal lifecycle tracking** — from initial offer through negotiation, acceptance, logistics, to delivery
- **Real-time status** — watch agents transition through standby → active → complete states
- **Conversational control** — talk to the orb to adjust agent permissions, review deals, or ask about market conditions

**Tech:** Supabase Edge Functions, Google Gemini via Lovable AI Gateway, PostgreSQL for deal/permission persistence

### 4. Multi-Channel Access (No Smartphone Required)

Every feature is accessible through channels designed for low-connectivity environments:

| Channel | How | What |
|---------|-----|------|
| **Web App** | Visit the URL | Full orb experience with voice, camera, maps |
| **USSD** | Dial `*384*87343#` | Menu-driven farming advice on any phone |
| **SMS** | Text a question | AI-powered reply via Twilio |
| **Voice Call** | Call the number | Speak your question, hear the answer read back |

**Tech:** Twilio (SMS + Voice IVR), Africa's Talking (USSD + SMS), Supabase Edge Functions

### 5. ML Intelligence Engine (5 Production Models)

Trained machine learning models that continuously monitor farm conditions:

| Model | Algorithm | Performance | Schedule |
|-------|-----------|-------------|----------|
| Anomaly Detection | Isolation Forest | 95%+ sensitivity | Hourly |
| Yield Prediction | XGBoost | R² = 0.85-0.92 | 2x daily |
| Pest Risk | XGBoost Classifier | AUC = 0.92 | 2x daily |
| Price Forecasting | ARIMA(1,1,1) | AIC optimized | Daily |
| Composite Risk | Weighted formula | Multi-factor | Daily |

Background workers run on automated schedules, storing predictions in the database for API access and orb-delivered insights.

**Tech:** scikit-learn, XGBoost, statsmodels (ARIMA), MLflow tracking, Supabase pg_cron scheduling

### 6. Shopping & Product Recommendations

When farmers ask about supplies, the orb displays a scrollable product carousel:
- Product images with graceful fallbacks
- Nearest store indicator with distance
- Price comparisons across co-ops, agri-stores, and online retailers
- Direct purchase links
- Auto-dismiss after 25 seconds to maintain the orb-centric UI

### 7. Farm Planning & Calendar

- AI-generated planting calendars based on local climate and crop selection
- Google Calendar integration via SMS-delivered links
- Task management with category tagging and completion tracking

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Web App  │  │  Voice   │  │   SMS    │  │  USSD    │           │
│  │ (Orb UI) │  │  (IVR)   │  │ (Twilio) │  │  (AT)    │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       └──────────────┴──────────────┴──────────────┘               │
│                              │                                      │
├──────────────────────────────┼──────────────────────────────────────┤
│                     INTELLIGENCE LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐           │
│  │ Gemini AI   │  │ Agent Crew  │  │ ML Models (5)    │           │
│  │ (Chat/Vision│  │ (Negotiate, │  │ (Anomaly, Yield, │           │
│  │  Agronomist)│  │  Logistics) │  │  Pest, Price,    │           │
│  └─────────────┘  └─────────────┘  │  Composite Risk) │           │
│                                     └──────────────────┘           │
├────────────────────────────────────────────────────────────────────┤
│                        GeoAI LAYER                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐         │
│  │ NASA GIBS    │  │ NASA POWER   │  │ OpenStreetMap    │         │
│  │ (NDVI Tiles) │  │ (Climate)    │  │ (Buildings/Water)│         │
│  └──────────────┘  └──────────────┘  └──────────────────┘         │
├────────────────────────────────────────────────────────────────────┤
│                      DATA LAYER                                     │
│  ┌─────────────────────────────────────────────────────┐           │
│  │ PostgreSQL (Supabase)                                │           │
│  │ Tables: farmers, conversation_logs, farm_plans,      │           │
│  │         agent_deals, agent_permissions, otp_codes     │           │
│  └─────────────────────────────────────────────────────┘           │
└────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + TypeScript + Vite | SPA with orb-centric voice-first UX |
| Styling | Tailwind CSS + shadcn/ui | Glassmorphic design system with refractive light effects |
| Maps | Leaflet + React-Leaflet | Interactive GIS with satellite/NDVI tile layers |
| AI Chat | Google Gemini (Flash/Pro) | Conversational agronomist with vision capabilities |
| AI Gateway | Lovable AI Gateway | Zero-config access to Gemini models |
| Backend | Supabase Edge Functions (Deno) | Serverless API endpoints for agents, chat, geo-intelligence |
| Database | PostgreSQL (Supabase) | Structured data persistence with RLS |
| SMS/Voice | Twilio | Two-way SMS, voice IVR with speech recognition |
| USSD | Africa's Talking | Menu-driven access for feature phones |
| Satellite | NASA GIBS + NASA POWER | NDVI vegetation tiles + climate/radiation data |
| Weather | Open-Meteo | Hyper-local forecasts and historical data |
| GIS Data | OpenStreetMap Overpass | Building and water source detection |
| ML Models | scikit-learn, XGBoost, ARIMA | 5 production prediction models |
| ML Tracking | MLflow | Model versioning and experiment tracking |
| Charts | Recharts | Data visualization for predictions and analytics |

---

## Project Structure

```
src/
├── components/
│   ├── GreenOrb.tsx              # Animated orb (12 emotions, eye tracking, speech sync)
│   ├── OrbController.tsx         # Voice, chat, onboarding, wake word detection
│   ├── MiniOrbGuide.tsx          # Companion orb that follows across dashboard tabs
│   ├── FarmBoundaryMap.tsx        # Full GIS map (NDVI, GPS tracking, feature detection)
│   ├── ProductCarousel.tsx       # Shopping cards with images and store distances
│   ├── CameraCapture.tsx         # Camera for crop/pest diagnosis via Gemini Vision
│   ├── WeatherPopup.tsx          # Weather integration display
│   ├── MarketPredictionCard.tsx  # Market price prediction cards
│   ├── BiosecurityCard.tsx       # Biosecurity alerts
│   ├── AccessibilityPanel.tsx    # Accessibility settings
│   ├── VoiceOnboarding.tsx       # Guided voice tour with multi-language support
│   └── ui/                      # shadcn/ui component library
│   ├── AgentModules.tsx           # Agent Crew, GeoAI, Deals, Permissions (drawer content)
├── pages/
│   ├── Index.tsx                 # Unified orb-centric experience (orbital buttons + drawers)
│   └── PhoneNumbers.tsx          # Twilio number management
├── hooks/
│   ├── useWeather.ts             # Open-Meteo weather integration
│   └── use-mobile.tsx            # Responsive breakpoint detection
├── integrations/
│   ├── supabase/                 # Auto-generated client and types
│   └── analytics.ts             # Usage analytics
└── utils/
    └── tts.ts                   # Text-to-speech utilities

supabase/functions/
├── chat/                         # AI chat with vision, tool calling, product recommendations
├── agent-negotiate/              # Autonomous agent negotiation engine
├── geo-intelligence/             # GeoAI backend (NASA POWER, Open-Meteo, Overpass API)
├── farm-plans/                   # Farm plan CRUD operations
├── twilio-sms/                   # SMS handler (welcome, weather, calendar links)
├── twilio-voice/                 # Voice IVR with speech-to-text
├── twilio-number/                # Phone number search and provisioning
├── ussd-callback/                # USSD menu handler (Africa's Talking)
├── sms-callback/                 # SMS auto-reply (Africa's Talking)
├── send-farm-sms/                # Outbound farm SMS notifications
├── at-outbound/                  # Africa's Talking outbound messaging
├── voice-callback/               # Voice call callback handler
└── elevenlabs-tts/               # Optional premium text-to-speech
```

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/abuti-spinach.git
cd abuti-spinach
npm install
npm run dev
```

### Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

### Edge Function Secrets

| Secret | Purpose |
|--------|---------|
| `LOVABLE_API_KEY` | AI Gateway (Gemini models) |
| `TWILIO_ACCOUNT_SID` | Twilio SMS and Voice |
| `TWILIO_AUTH_TOKEN` | Twilio authentication |
| `TWILIO_FROM_NUMBER` | Twilio sender number |
| `AT_API_KEY` | Africa's Talking USSD/SMS |

---

## What We Are Trying to Achieve

### The Problem

33 million+ smallholder farmers across Southern Africa face:
- **No access to agronomic expertise** — extension officers are scarce and expensive
- **No early warning systems** — pest outbreaks, weather risks, and market crashes hit without warning
- **No precision tools** — satellite data, NDVI maps, and soil analysis are locked behind expensive enterprise software
- **No digital infrastructure** — many farmers have feature phones with no internet access

### Our Answer

A single platform where:
1. **Any farmer can talk to an AI agronomist** via voice, text, SMS, or USSD — in their own language
2. **Satellite intelligence is free and automatic** — NDVI vegetation health, irrigation planning, crop suitability, all derived from NASA satellite passes over their exact GPS coordinates
3. **AI agents negotiate and sell on their behalf** — autonomous agents find buyers, negotiate prices, and coordinate logistics within farmer-set boundaries
4. **ML models predict the future** — yield forecasts, pest outbreak warnings, price movements, and composite risk scores delivered proactively
5. **The orb is always there** — a persistent, context-aware AI companion that follows them across every screen, explains complex data simply, and acts on their behalf

### Roadmap

| Phase | Component | Status |
|-------|-----------|--------|
| 1 | Database Infrastructure | Complete |
| 2 | ML Intelligence Engine (5 models) | Complete |
| 3 | Real Satellite Data Integration (NASA GIBS, NASA POWER) | Complete |
| 4 | GeoAI Precision Farming (NDVI, irrigation, crop suitability) | Complete |
| 5 | Autonomous Agent Crew | Complete |
| 6 | Orb Context Awareness (cross-tab intelligence) | Complete |
| 7 | Farm Boundary GPS Mapping | Complete |
| 8 | Building and Water Source Detection | Complete |
| 9 | **Orb-Centric Unified UI** (orbital buttons + slide-up drawers) | **Complete** |
| Next | Sentinel-2 10m resolution NDVI via Copernicus | Planned |
| Next | Soil type classification from geological survey data | Planned |
| Next | Topography elevation contour layers | Planned |
| Next | Multi-language expansion (isiZulu, Sesotho, Setswana) | Planned |
| Next | Offline-first PWA with local model inference | Planned |

### Impact Targets

| Metric | Target |
|--------|--------|
| Farmers served | 33M+ smallholder farmers across Southern Africa |
| Access channels | Web, Voice, Camera, USSD, SMS, Phone Call |
| Languages | English (ZA), isiZulu — expanding to 5+ |
| Cost per AI query | ~$0.001 (Gemini Flash) |
| Satellite data cost | $0 (NASA open data) |
| Minimum device requirement | Any phone with voice or SMS |

---

## License

MIT — [LICENSE](LICENSE)

---

*AbUti Spinach — Because every farmer deserves a genius in their pocket.*
