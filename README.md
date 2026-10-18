# CarbonWise AI — Climate Intelligence & Personal Carbon Analytics Platform
**Aligned with UN Sustainable Development Goal 13: Climate Action**

CarbonWise AI is a unified, full-stack environmental analytics platform designed to bridge the gap between **macro atmospheric climate telemetry** and **micro personal carbon accounting**. It integrates real-time weather observations, ground air-quality telemetry, and multi-decadal historical climate baselines with personal carbon tracking, deterministic "What-If" lifestyle simulation, adaptive habit coaching, and explainable AI insights.

---

## 1. Problem Statement & Project Objectives

### The Problem
1. **Fragmented Environmental Datasets**: Climate monitoring data is spread across heterogeneous portals (national weather models, air monitoring stations, satellite-derived reanalysis datasets), making it difficult for individuals and organizations to understand local environmental changes.
2. **Delayed & Unexplainable Alerts**: Most consumer environmental apps show raw numbers (e.g., $38^\circ\text{C}$ or $120\,\mu\text{g/m}^3$) without baseline context, failing to explain whether an observation is an extreme anomaly, a seasonal expected variation, or a faulty sensor flatline.
3. **Black-Box Carbon Tools & Hallucinated Advice**: Typical carbon calculators output a static number without showing the underlying emission factors, without tracking historical trends, or by using unconstrained generative AI that hallucinates measurements and claims causation without scientific evidence.
4. **Conflating Weather with Climate Change**: Public discussions and superficial tools often confuse short-term local weather fluctuations with long-term climatological trends, or mix hypothetical lifestyle savings with verified physical reductions.

### Project Objectives
- **Ingest Verified Live Telemetry**: Automatically retrieve real-time weather and ambient air quality from documented, authoritative APIs (Open-Meteo, OpenAQ) without requiring manual data entry.
- **Explainable Statistical Anomaly Detection**: Build a transparent, deterministic detection engine using robust statistical methods (Median Absolute Deviation, Robust Z-scores, and seasonal reference normals) that separates true atmospheric anomalies from sensor data-quality faults.
- **Strict Data Segregation**: Maintain absolute scientific separation between:
  1. *Empirical Ground Truth Observations* (verified historical sensor readings stored in PostgreSQL).
  2. *Current Weather Telemetry* (live hourly atmospheric measurements).
  3. *Short-Term Weather Forecasts* (7-day numerical weather predictions with ensemble uncertainty spreads).
  4. *Multi-Decadal Climate Projections* (IPCC AR6 CMIP6 scenarios: SSP1-2.6, SSP2-4.5, SSP5-8.5).
  5. *Modeled "What-If" Personal Savings* (hypothetical scenarios derived transparently from published emission factors).
- **Controlled, Safe AI Assistance**: Use Google Gemini strictly as a natural-language summarizer and reporting assistant. Generative AI is never allowed to invent data, calculate numerical baselines, or diagnose climate trends. All AI requests are rate-limited, SHA-256 cached in PostgreSQL, and backed by deterministic fallbacks.

---

## 2. System Architecture & Data-Flow Diagram

```mermaid
flowchart TD
    subgraph External_Providers["Authoritative External Data Providers"]
        OM_W["Open-Meteo Weather API<br/>(Temperature, Rain, Wind, Humidity)"]
        OM_AQ["Open-Meteo Air Quality<br/>(PM2.5, PM10, US AQI)"]
        OAQ["OpenAQ API v3<br/>(Physical Ground Stations)"]
        NASA["NASA POWER / Climatology<br/>(1991–2020 WMO Standard Normals)"]
        CMIP6["IPCC AR6 CMIP6 Ensemble<br/>(SSP1-2.6, SSP2-4.5, SSP5-8.5)"]
        GEMINI["Google Gemini API<br/>(gemini-2.5-flash)"]
    end

    subgraph Backend_Ingestion["Node.js / Express Backend Engine"]
        SCHED["Scheduled Ingestion Worker<br/>(environmentScheduler.js)"]
        GEO["Geocoding Provider<br/>(environmentUtils.js)"]
        NORM["Normalization & Unit Engine<br/>(Celsius, mm, µg/m³, km/h)"]
        DET["Statistical Anomaly Engine<br/>(MAD & Robust Z-Scores)"]
        CARB["Carbon Intelligence & What-If Engine<br/>(Deterministic Emission Factors)"]
        AI_GATE["Gemini Cache & Rate-Limit Gateway<br/>(geminiChatService.js)"]
    end

    subgraph Storage["PostgreSQL Database (ACID Relational)"]
        T_USERS[("users")]
        T_REGIONS[("environment_regions")]
        T_OBS[("environment_observations")]
        T_ALERTS[("environment_alerts")]
        T_RUNS[("environment_ingestion_runs")]
        T_ACT[("activities")]
        T_SCEN[("scenarios")]
        T_COACH[("coach_plans & coach_actions")]
        T_IMPACT[("impact_baselines & impact_reports")]
        T_CACHE[("ai_response_cache")]
    end

    subgraph Frontend["React 19 + Vite Dark SaaS Dashboard"]
        UI_DASH["Dashboard & Live Monitoring (/live-climate)"]
        UI_TREND["Climate Trends & Baselines (/climate-trends)"]
        UI_ALERT["Air Quality & Alert History (/alerts)"]
        UI_INTEL["Carbon Intelligence (/carbon-intelligence)"]
        UI_SIM["What-If Carbon Simulator (/simulator)"]
        UI_COACH["Adaptive AI Eco-Coach (/action-plan)"]
        UI_FORECAST["Carbon Footprint Forecast (/carbon-forecast)"]
        UI_IMPACT["Sustainability Impact Tracker (/impact)"]
    end

    OM_W --> NORM
    OM_AQ --> NORM
    OAQ --> NORM
    NASA --> NORM
    NORM --> T_OBS
    SCHED --> NORM

    T_OBS --> DET
    DET --> T_ALERTS
    
    T_ACT --> CARB
    CARB --> T_SCEN
    CARB --> T_COACH
    CARB --> T_IMPACT

    T_OBS --> AI_GATE
    T_ACT --> AI_GATE
    AI_GATE <--> GEMINI
    AI_GATE <--> T_CACHE

    T_REGIONS --> Frontend
    T_OBS --> Frontend
    T_ALERTS --> Frontend
    T_SCEN --> Frontend
    T_COACH --> Frontend
    T_IMPACT --> Frontend
    CMIP6 --> UI_TREND
```

---

## 3. Technology Stack & Data Providers

### Frontend Technologies
- **Framework**: React 19 (`react`, `react-dom` `^19.2.4`)
- **Build Tool**: Vite 8 (`vite` `^8.0.0`)
- **Routing**: React Router v7 (`react-router-dom` `^7.13.1`)
- **Styling**: Vanilla CSS (Tailored dark environmental palette: Deep Navy `#0B1120`, Emerald Green `#10B981`, Mint `#34D399`, Slate `#1E293B`)
- **Charts & Data Visualization**: Chart.js (`chart.js` `^4.5.1`, `react-chartjs-2` `^5.3.1`)
- **Icons**: Lucide React (`lucide-react` `^0.577.0`)
- **HTTP Client**: Axios (`axios` `^1.13.6`)

### Backend Technologies
- **Runtime**: Node.js (v20+ / v22 LTS tested)
- **Framework**: Express 5 (`express` `^5.2.1`)
- **Database Driver**: `pg` `^8.20.0` (PostgreSQL client with SSL pooling)
- **Authentication**: JSON Web Tokens (`jsonwebtoken` `^9.0.3`) + Bcrypt password hashing (`bcrypt` `^6.0.0`)
- **PDF Generation**: PDFKit (`pdfkit` `^0.18.0`)
- **Generative AI SDK**: Google GenAI SDK (`@google/generative-ai` `^0.24.1`)
- **Test Runner**: Node.js Built-in Test Runner (`node --test`)

### Verified Data Providers & Attribution
1. **Open-Meteo Weather API** ([open-meteo.com](https://open-meteo.com/)):
   - *Data*: Hourly temperature, relative humidity, precipitation, wind speed, surface pressure, 7-day numerical ensemble weather predictions.
   - *Attribution*: Licensed under Creative Commons Attribution 4.0 International (CC BY 4.0).
2. **Open-Meteo Air Quality API**:
   - *Data*: Ambient particulate matter (PM2.5, PM10) and US Air Quality Index (AQI) derived from European Copernicus and CAMS atmospheric models.
   - *Attribution*: Open-Meteo.com / Copernicus Atmosphere Monitoring Service.
3. **OpenAQ Community API v3** ([openaq.org](https://openaq.org/)):
   - *Data*: Physical ground monitoring station readings (PM2.5, PM10, NO₂, O₃, CO, SO₂).
   - *Attribution*: Data provided by the OpenAQ Community and participating government environmental protection agencies.
4. **NASA POWER / Climatological Reference Normals**:
   - *Data*: 30-year climatological baseline normals (1991–2020 WMO standard period) for decadal trend benchmarking.
5. **IPCC Sixth Assessment Report (AR6) CMIP6 Models**:
   - *Data*: Coupled Model Intercomparison Project Phase 6 global warming pathways (SSP1-2.6, SSP2-4.5, SSP5-8.5).

---

## 4. Installation & Startup Instructions

### Prerequisites
- Node.js (v20.0.0 or higher recommended)
- PostgreSQL (v14 or higher) running locally or hosted on Render / Supabase / Neon
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/Jaswant-Karun/carbonwise-ai.git
cd Carbonwise_Ai_SDG13
```

### 2. Backend Setup
```bash
cd carbonwise-backend
npm install
```
Configure your environment variables (see Section 6), then start the backend service:
```bash
# Development mode with auto-reload:
npm run dev

# Or production mode:
npm start
```
The backend initializes database tables on startup and listens at `http://localhost:5000`.

### 3. Frontend Setup
In a separate terminal:
```bash
cd carbonwise-frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 5. Safe PostgreSQL Setup & Versioned Migrations

The database setup is **completely safe and non-destructive**. It never drops existing tables or deletes user records.

### Database Setup
1. Create a database in your PostgreSQL instance:
   ```sql
   CREATE DATABASE carbonwise;
   ```
2. The application includes both an idempotent startup initializer ([`src/models/schema.js`](carbonwise-backend/src/models/schema.js)) and numbered migration scripts in [`carbonwise-backend/migrations`](carbonwise-backend/migrations):
   - `001_environment_intelligence.sql`: Regions, sources, observations, alerts, ingestion runs.
   - `002_live_climate_ingestion.sql`: Unique constraints for idempotent telemetry upserts.
   - `003_anomaly_engine.sql`: Severity, statistical detection method, and persistent anomaly fields.
   - `004_openaq_air_quality.sql`: Station ID, attribution, and alert resolution history JSONB.
   - `005_carbon_intelligence_and_coach.sql`: Scenarios, coach plans, coach actions, coach goals, impact baselines, and impact reports.

### Applying Migrations Manually (Optional / CI/CD)
```bash
psql "$DATABASE_URL" -f migrations/001_environment_intelligence.sql
psql "$DATABASE_URL" -f migrations/002_live_climate_ingestion.sql
psql "$DATABASE_URL" -f migrations/003_anomaly_engine.sql
psql "$DATABASE_URL" -f migrations/004_openaq_air_quality.sql
psql "$DATABASE_URL" -f migrations/005_carbon_intelligence_and_coach.sql
```

Each migration has a matching `.down.sql` file for safe rollback of newly added objects.

---

## 6. Environment Configuration (.env Examples)

### Backend Configuration (`carbonwise-backend/.env`)
Create `carbonwise-backend/.env` containing the following template:

```env
# PostgreSQL Connection (Local or Hosted)
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/carbonwise

# Enable SSL for hosted databases (e.g. Render, Supabase, Neon)
PG_SSL=false

# Application Server Port
PORT=5000

# JWT Authentication Secret (Use a strong random string in production)
JWT_SECRET=your_jwt_secret_key_change_in_production

# Google Gemini API Key (Optional: system runs deterministic algorithms if omitted)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_MS=12000
GEMINI_MAX_OUTPUT_TOKENS=420
GEMINI_CACHE_TTL_MS=86400000
GEMINI_RATE_LIMIT_PER_MINUTE=10

# OpenAQ API Key (Optional: for physical ground stations; Open-Meteo AQ runs without key)
OPENAQ_API_KEY=your_openaq_api_key_here

# Background Climate Ingestion Interval (30 minutes default)
ENVIRONMENT_SYNC_INTERVAL_MS=1800000
```

### Frontend Configuration (`carbonwise-frontend/.env`)
Create `carbonwise-frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

> [!CAUTION]
> Never commit actual credentials, `.env` files, or API keys to Git. Both `.env` files are ignored in `.gitignore`.

---

## 7. Ingestion & Anomaly Detection Methodology

### Telemetry Ingestion Pipeline
1. **Coordinate Validation**: Validates user-selected regions ($-90^\circ \le \text{lat} \le 90^\circ$, $-180^\circ \le \text{lon} \le 180^\circ$).
2. **Provider Dispatch**: Fetches multi-variable weather (temperature, humidity, rain, wind, pressure) and air quality (PM2.5, PM10, AQI).
3. **Unit Normalization**: Standardizes variables into scientific units ($^\circ\text{C}$, $\text{mm}$, $\text{km/h}$, $\text{hPa}$, $\mu\text{g/m}^3$) while preserving original source measurements.
4. **Idempotent Storage**: Uses `ON CONFLICT (source_id, region_id, observed_at) DO UPDATE` to prevent duplicate observations.
5. **Freshness Tracking**: Categorizes telemetry as `fresh` ($\le 120$ minutes old) or `stale`.

### Mathematical Anomaly Detection
The anomaly detection engine in [`climateAnomalyService.js`](carbonwise-backend/src/services/climateAnomalyService.js) uses **robust, non-parametric statistics** rather than simple averages that are easily distorted by extreme outliers:

$$\text{Median} = \tilde{x} = \text{median}(X)$$

$$\text{MAD} = \text{median}(|x_i - \tilde{x}|)$$

$$\text{Robust } \sigma \approx 1.4826 \times \text{MAD}$$

$$\text{Robust Z-Score} = \frac{x_{\text{observed}} - \tilde{x}}{\text{Robust } \sigma}$$

$$\text{Threshold} = \max(\tilde{x} \times 1.5,\; \tilde{x} + 2 \times \text{Robust } \sigma)$$

### Atmospheric Anomaly vs. Data Quality Fault
The engine rigorously separates true atmospheric events from sensor/provider failure modes:

| Detection Type | Category | Condition / Evidence | Action Taken |
| :--- | :--- | :--- | :--- |
| **Atmospheric Heat / Freeze** | `atmospheric` | $x_{\text{observed}} \ge \text{Threshold}$ and $\text{Robust } Z \ge 2.0$ | Creates `warning` or `critical` alert with deviation |
| **Persistent Anomaly** | `atmospheric` | Deviation sustained for $> 6$ consecutive hours | Flags `isPersistent: true` for heatwave/cold-snap |
| **Flatline Sensor Fault** | `data_quality` | Identical value repeated for $\ge 6$ consecutive readings | Flags sensor failure; excluded from climate anomaly statistics |
| **Implausible Value** | `data_quality` | Temperature outside physical boundary ($-60^\circ\text{C}$ to $+60^\circ\text{C}$) | Flags sensor corruption; confidence score downgraded |
| **Stale Telemetry** | `data_quality` | No new observation for $> 6$ hours | Flags `stale` data status badge |

---

## 8. How to Interpret the Dashboard, Baselines & Alerts

### 1. Scientific Integrity Principle
> [!IMPORTANT]
> **One weather event is NOT proof of climate change.**
> A single record-breaking hot day or heavy thunderstorm is an acute meteorological weather anomaly. **Climate change** represents statistically significant shifts in multi-decadal distributions (typically 30-year WMO climate normal periods, such as 1991–2020). CarbonWise AI explicitly distinguishes short-term weather anomalies from decadal climate trend lines.

### 2. Multi-Tier Data Separation
To prevent misleading users, CarbonWise AI visualizes four distinct data tiers:
- **Tier 1: Historical Ground Truth** — Verified physical observations recorded in PostgreSQL.
- **Tier 2: Current Telemetry** — The latest live sensor reading.
- **Tier 3: Short-Term NWP Forecast** — 7-day numerical weather predictions generated by atmospheric physics models (ECMWF/GFS), showing 10th–90th percentile uncertainty bands.
- **Tier 4: Long-Term Climate Projections** — 2025–2050 IPCC CMIP6 multi-model scenario trajectories based on greenhouse gas forcing pathways, not daily weather predictions.

### 3. Personal Carbon Footprint vs. Planetary Climate
Personal carbon accounting (activities logged in kg CO₂) is kept on a completely separate analytical pipeline from macro environmental monitoring (weather and air quality):
- **Carbon Intelligence**: Analyzes where emissions came from based on EPA/IPCC-aligned emission factors ($0.21\,\text{kg/km}$ transport, $0.50\,\text{kg/kWh}$ electricity, etc.).
- **What-If Simulator**: Models hypothetical behavioral changes. Potential savings are clearly flagged with an estimation disclaimer and **never modify actual activity history**.

---

## 9. Controlled Gemini Integration & Graceful Fallbacks

Google Gemini (`gemini-2.5-flash`) acts strictly as an **explanation and reporting assistant**. It is barred from numerical calculations and data fabrication.

### Safety & Reliability Mechanisms in [`geminiChatService.js`](carbonwise-backend/src/services/geminiChatService.js)
1. **PostgreSQL Response Caching**: Responses are stored in `ai_response_cache` using a SHA-256 hash of the normalized input, prompt version, model version, and user ID:
   $$\text{Cache Key} = \text{SHA256}(\text{userId} + \text{task} + \text{input} + \text{promptVersion} + \text{modelVersion})$$
   Identical requests reuse the cached response, preventing external API calls.
2. **In-Flight Deduplication**: Multiple simultaneous requests for the same insight join a single pending promise rather than launching duplicate Gemini API calls.
3. **Per-User Rate Limiting**: Enforces a strict limit (10 requests/minute) using an in-memory sliding window.
4. **Deterministic Fallbacks**: If the Gemini API key is missing, network fails, or provider quota is exhausted (HTTP 429), the system automatically serves pre-computed, deterministic analytical summaries. **No page crashes or displays blank sections.**

---

## 10. Verification Pass & Actual Test Results

The platform has undergone rigorous automated testing with zero mock fabrications:

### 1. Backend Integration & Unit Tests
Run the backend test suite:
```powershell
cd carbonwise-backend
npm test
```
**Actual Outcome**:
```text
✔ 1. Server and PostgreSQL connectivity
✔ 2. Authentication setup and user tokens
✔ 3. Geocoding location search (real Open-Meteo)
✔ 4. Environmental region creation & live data ingestion
✔ 5. Summary and real-time telemetry verification
✔ 6. Climate Trends and historical aggregation endpoint
✔ 7. 7-Day Weather Forecasts separating predictions from actuals
✔ 8. CMIP6 Climate Projections with explicit assumptions and models
✔ 9. Air-Quality telemetry endpoint
✔ 10. User Activity and Carbon Intelligence Engine (Module 1)
✔ 11. What-If Carbon Simulator (Module 2)
✔ 12. Adaptive AI Eco-Coach (Module 3)
✔ 13. Carbon Forecasting and Anomaly Detection (Module 4)
✔ 14. Sustainability Impact Tracker (Module 5)
✔ 15. Authentication & User-Data Isolation
✔ 16. Gemini deterministic fallbacks and caching
...
# tests 79
# pass 79
# fail 0
# cancelled 0
# skipped 0
```

### 2. Frontend Linting & Production Build
Run frontend quality checks:
```powershell
cd carbonwise-frontend
npm run lint
npm run build
```
**Actual Outcome**:
- `npm run lint`: **0 errors** (all fast refresh and hook dependency checks pass).
- `npm run build`: Vite v8 compiled in **578 ms** with zero errors (`dist/index.html`, `dist/assets/index.css`, `dist/assets/index.js`).

---

## 11. Complete API Endpoint Documentation

All endpoints are hosted at `http://localhost:5000/api`. Authenticated routes require `Authorization: Bearer <token>`.

### 1. Authentication & System Health
| Method | Endpoint | Auth | Purpose |
| :--- | :--- | :---: | :--- |
| `GET` | `/health` | Public | Server liveness and database connection status |
| `POST` | `/auth/register` | Public | Register user (`name`, `email`, `password`) |
| `POST` | `/auth/login` | Public | Login user, returns JWT and user profile |
| `GET` | `/auth/me` | User | Get authenticated user profile |

### 2. Live Environmental Telemetry & Alerts
| Method | Endpoint | Auth | Purpose |
| :--- | :--- | :---: | :--- |
| `GET` | `/environment/locations/search?q={query}` | User | Open-Meteo geocoding search for global locations |
| `GET` | `/environment/regions` | User | List user's registered monitoring regions |
| `POST` | `/environment/regions` | User | Create region (`name`, `latitude`, `longitude`, `timezone`) |
| `GET` | `/environment/regions/:id/summary` | User | Latest telemetry, baselines, and freshness status |
| `POST` | `/environment/regions/:id/refresh` | User | Trigger live ingestion from Open-Meteo |
| `GET` | `/environment/regions/:id/trends` | User | Aggregated time-series and OLS decadal trend line |
| `GET` | `/environment/regions/:id/forecasts` | User | 7-day NWP weather forecast with uncertainty bounds |
| `GET` | `/environment/regions/:id/climate-projections` | User | CMIP6 SSP1-2.6, SSP2-4.5, SSP5-8.5 scenarios |
| `GET` | `/environment/regions/:id/air-quality` | User | OpenAQ ground station telemetry or Open-Meteo AQ |
| `GET` | `/environment/regions/:id/ai-insights` | User | Regional AI insight cards (cached / fallback) |
| `GET` | `/environment/alerts` | User | Filterable environmental anomaly alert list |
| `PATCH` | `/environment/alerts/:id` | User | Update alert status (`open`, `acknowledged`, `resolved`) |

### 3. Personal Carbon Intelligence & Sustainability Modules
| Method | Endpoint | Auth | Purpose |
| :--- | :--- | :---: | :---: |
| `POST` | `/activities` | User | Log carbon activity (`activity_type`, `details`, `date`) |
| `GET` | `/activities` | User | List authenticated user's activity records |
| `GET` | `/intelligence?period={days}` | User | Category breakdown, delta comparison, recommendations |
| `POST` | `/scenarios/preview` | User | Calculate hypothetical What-If savings without saving |
| `POST` | `/scenarios` | User | Save What-If scenario to database |
| `GET` | `/scenarios` | User | List saved scenarios |
| `POST` | `/coach/plans` | User | Generate 7-day personalized adaptive coaching plan |
| `PATCH` | `/coach/actions/:id` | User | Update action status (`planned`, `completed`, `skipped`) |
| `GET` | `/coach/goals` | User | List weekly / monthly reduction targets |
| `POST` | `/coach/goals` | User | Create a carbon reduction goal in kg CO₂ |
| `GET` | `/forecast?period={p}&horizon={h}` | User | Personal carbon footprint forecast & spike anomalies |
| `POST` | `/impact/reports` | User | Generate baseline vs observed impact report |
| `GET` | `/impact/reports/:id/pdf` | User | Export audit report as PDF |

---

## 12. Step-by-Step Demonstration Workflow (For College Review & Viva)

During your project viva or live demonstration, follow this sequence to demonstrate real data ingestion, statistical anomaly detection, and segregation of metrics:

### Step 1: User Login & Location Selection
1. Log in to the application at `http://localhost:5173`.
2. Navigate to **Live Monitoring** (`/live-climate`).
3. Click **Add Location** and search for a city (e.g., `Bengaluru` or `London`). The app calls the Open-Meteo Geocoding API and returns coordinates ($12.97^\circ\,\text{N}, 77.59^\circ\,\text{E}$).
4. Click to save. The backend saves the region into PostgreSQL `environment_regions` and immediately triggers an initial live telemetry ingestion.

### Step 2: Live Ingestion & Telemetry Verification
1. Click **Sync Telemetry** on the dashboard header.
2. Watch the backend logs: `[scheduler] Ingested 5 points for "Bengaluru Urban"`.
3. The dashboard cards update with real empirical measurements:
   - Temperature ($^\circ\text{C}$)
   - Atmospheric Pressure ($\text{hPa}$)
   - Wind Speed ($\text{km/h}$)
   - Relative Humidity ($\%$)
   - Freshness badge shows **"Live sync"** ($\le 120$ min).

### Step 3: Statistical Baseline & Anomaly Engine
1. Point to the **Statistical Baseline** card on the screen.
2. Explain that the baseline is computed from the historical median ($\tilde{x}$) and Median Absolute Deviation (MAD), not a simple average.
3. If an observation exceeds $\max(\tilde{x} \times 1.5,\; \tilde{x} + 2\sigma)$, the detection engine flags it as an anomaly.
4. Navigate to **Air Quality & Alerts** (`/alerts`) to inspect generated alerts with their evidence, detection method (`robust_zscore_mad`), and severity.
5. Demonstrate clicking **Acknowledge** or **Resolve** on an alert, showing that the resolution history timestamp is stored in PostgreSQL.

### Step 4: Multi-Tier Forecast vs. Climate Projection
1. Navigate to **Climate Trends & Forecasts** (`/climate-trends`).
2. Show the **Ordinary Least Squares (OLS) trend line** and comparison against the **1991–2020 WMO Standard Climate Normal**.
3. Point out the clear visual separation between:
   - Historical ground observations (solid line).
   - 7-day NWP weather predictions with uncertainty envelope (dashed line with shaded band).
   - Long-term CMIP6 climate model projections (SSP1-2.6, SSP2-4.5, SSP5-8.5).
4. Highlight the disclaimer: *"Projections simulate multi-decadal climatological forcing, not day-to-day weather events."*

### Step 5: Personal Carbon Modules (What-If Simulator & Eco-Coach)
1. Navigate to **What-If Simulator** (`/simulator`).
2. Demonstrate adjusting electricity reduction by 20% or switching 50% of transport from car to public transit.
3. Show that potential savings ($10.5\,\text{kg CO}_2$) are calculated deterministically using published emission factors.
4. Emphasize to the evaluators: **The simulator does not alter actual user activity records**, and the UI displays an estimation disclaimer banner.
5. Navigate to **Eco-Coach** (`/action-plan`) to show the 7-day plan adapted to the user's highest-emitting categories.

### Step 6: Gemini Caching & Fallback Proof
1. Trigger an AI Insight card. Point to backend logs: `[gemini] task=env_insights cache_hit=false latency_ms=1200`.
2. Refresh the page: the backend responds in $< 10\,\text{ms}$ with `[gemini] task=env_insights cache_hit=true`, proving that the response was served from PostgreSQL `ai_response_cache` without hitting the Google Gemini API.
3. Explain that if the network drops or quota is exhausted, deterministic rule-based cards are displayed automatically.

---

## 13. Viva Voce Questions & Authoritative Answers

### Q1: What UN Sustainable Development Goal does this project target?
> **Answer**: It directly supports **UN SDG 13: Climate Action**, specifically:
> - *Target 13.3*: Improve education, awareness-raising, and human and institutional capacity on climate change mitigation, adaptation, impact reduction, and early warning.
> - *Target 13.b*: Promote mechanisms for raising capacity for effective climate change-related planning and management.

### Q2: Why is one extreme weather event not proof of climate change?
> **Answer**: Weather is the atmospheric state at a specific time and location (hours to days), driven by chaotic thermodynamic shifts. Climate is the statistical distribution of weather over prolonged periods (typically 30 years according to the World Meteorological Organization). A single extreme temperature spike is an acute meteorological anomaly; only a statistically significant decadal shift in the frequency, duration, or intensity of such anomalies constitutes evidence of climate change.

### Q3: Why did you use Median Absolute Deviation (MAD) instead of mean and standard deviation?
> **Answer**: Standard deviation assumes a normal (Gaussian) distribution and is easily skewed by extreme outliers. Environmental telemetry often includes extreme weather spikes or corrupted sensor reads. MAD is a **robust, non-parametric statistic** that measures dispersion around the median without being distorted by anomalies, ensuring a reliable baseline.

### Q4: How do you prevent generative AI from hallucinating measurements?
> **Answer**: We use a strict **three-tier boundary architecture**:
> 1. Numerical calculations, statistical anomaly detection, and emission factor math are computed 100% deterministically in Node.js before any AI prompt is constructed.
> 2. Gemini receives only verified numerical summary evidence with explicit negative constraints: *"DO NOT invent measurements, alerts, or confidence scores."*
> 3. AI outputs are validated against JSON schemas, SHA-256 cached in PostgreSQL, and backed by deterministic fallback cards if the model fails.

### Q5: How do the What-If Simulator and Eco-Coach preserve scientific integrity?
> **Answer**: Many apps falsely record simulated savings as verified reductions. CarbonWise AI enforces **strict separation of concerns**:
> - Logged activities represent historical emissions.
> - What-If scenarios represent hypothetical potential savings and never alter historical records.
> - Completing an Eco-Coach action tracks habit compliance; it is never claimed as a proven carbon reduction unless verified by a corresponding decrease in subsequent activity records.

### Q6: What happens if OpenAQ has no station near the selected location?
> **Answer**: Rather than falsely reporting zero pollution ("clean air"), the system returns an explicit status `data_unavailable` with the message: *"No suitable ground monitoring station found within 25 km radius."* Open-Meteo's atmospheric model provides continuous gridded ambient estimates as an alternate data layer.

---

## 14. Data Attribution & Limitations

### Data Attribution
- Weather forecasts, geocoding, and historical weather data provided by [Open-Meteo.com](https://open-meteo.com) under CC BY 4.0.
- Air quality telemetry provided by the [OpenAQ Community](https://openaq.org) and participating government environmental agencies.
- 30-year climatological normals adapted from the [NASA POWER Project](https://power.larc.nasa.gov/).
- Climate change scenarios adapted from the [IPCC AR6 Working Group I CMIP6 Multi-Model Ensemble](https://www.ipcc.ch/report/ar6/wg1/).

### Limitations
- **Ground Sensor Availability**: Physical OpenAQ stations are clustered around major metropolitan areas; rural coverage depends on gridded reanalysis models.
- **Short History Constraints**: The personal carbon forecast algorithm requires at least 3 observed days for weekly projections and 14 days for monthly projections. Sparse accounts display an insufficiency notice rather than extrapolating artificial values.
- **Emission Factor Regionality**: Carbon emission factors represent published national/international averages ($0.21\,\text{kg CO}_2/\text{km}$ transport, $0.50\,\text{kg CO}_2/\text{kWh}$ grid electricity). They should be customized with local power grid intensity factors for specific industrial audits.

---

## 15. License
Developed for academic presentation, demonstration, and evaluation under SDG 13 Climate Action guidelines. Licensed under the ISC License.
