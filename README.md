# CarbonWise AI

CarbonWise AI is a full-stack personal environmental analytics application. It
records user activities, calculates estimated carbon emissions, and turns that
history into deterministic analytics, scenarios, forecasts, goals, reports,
and optional AI-assisted explanations.

This README describes the functionality currently implemented in this
repository. It does not describe planned or mock features as completed.

## 1. Problem statement

Many carbon calculators produce a single number but do not help a person
understand where that number came from, what changed over time, or which
practical choices could be explored next. They also risk mixing measured
activity, hypothetical savings, forecasts, and AI-generated prose.

CarbonWise AI addresses this gap by keeping numerical processing in a
deterministic Node.js backend and using Gemini only for optional
natural-language assistance.

## 2. Proposed solution and innovation

The application combines:

- A shared carbon-calculation engine with centralized emission factors.
- PostgreSQL-backed activity history and user-owned module data.
- Explainable period comparisons, category rankings, recommendations, and
  anomaly rules.
- Estimate-only What-If scenarios that never modify actual activity records.
- A seven-day Eco-Coach plan that uses recorded history and completion history.
- A transparent moving-average forecast with explicit data sufficiency rules.
- Impact baselines, goal progress, report history, and PDF report export.
- A controlled Gemini integration with PostgreSQL caching, request
  de-duplication, timeouts, rate limits, and deterministic fallbacks.

The main innovation is the separation of **recorded emissions**, **modeled
potential savings**, **hypothetical scenario results**, **forecasts**, and
**natural-language explanations**. Completing an action is not treated as
proof that emissions decreased.

## 3. Integrated modules

1. **Smart Carbon Intelligence** (`/intelligence`)
   - Daily, weekly, and monthly summaries.
   - Category totals and contribution percentages.
   - Largest emission sources.
   - Equivalent-period comparisons.
   - Rule-based anomalies and ranked recommendations.

2. **What-If Carbon Simulator** (`/simulator`)
   - Baseline versus hypothetical scenario emissions.
   - Reductions for supported categories.
   - Transport-mode switching.
   - Saved, retrieved, updated, deleted, and compared scenarios.
   - Potential savings are clearly labeled as estimates.

3. **Adaptive AI Eco-Coach** (`/action-plan`)
   - Seven-day action plans based on recorded emission sources.
   - Weekly and monthly reduction goals.
   - Planned, in-progress, completed, and skipped action states.
   - Completion timestamps and completion-history-aware fallback actions.
   - Optional Gemini narrative; deterministic actions remain available without
     Gemini.

4. **Forecast & Anomalies** (`/forecast`)
   - Actual daily history displayed separately from projections.
   - Trailing seven-day moving-average forecasts.
   - Weekly and monthly horizon validation.
   - Rule-based anomaly detection with affected dates, categories, thresholds,
     and related activity records.

5. **Sustainability Impact Tracker** (`/impact`)
   - User-defined baselines.
   - Current-versus-baseline comparisons.
   - Category breakdowns, goals, action history, and report history.
   - Deterministic monthly report values.
   - Optional Gemini narrative and PDF export.

The sidebar also exposes Dashboard, Activity History, Climate Reports, legacy
AI Insights, and Profile pages.

## 4. Technology stack

### Frontend

- React 19
- Vite
- React Router
- Axios
- Chart.js and `react-chartjs-2`
- Lucide React icons
- Normal CSS (no utility CSS framework)

### Backend

- Node.js
- Express 5
- PostgreSQL via `pg`
- JWT authentication
- bcrypt password hashing
- PDFKit PDF generation
- Google Gemini SDK: `@google/generative-ai` `^0.24.1`

## 5. Actual repository structure

```text
Carbonwise_Ai_SDG13/
├── README.md
├── .gitignore
├── carbonwise-backend/
│   ├── .env.example
│   ├── package.json
│   ├── src/
│   │   ├── config/db.js
│   │   ├── controllers/
│   │   ├── middlewares/authMiddleware.js
│   │   ├── models/schema.js
│   │   ├── routes/
│   │   ├── services/
│   │   └── index.js
│   └── test/
│       ├── carbonIntelligenceService.test.js
│       ├── whatIfSimulatorService.test.js
│       ├── scenarioController.test.js
│       ├── ecoCoachService.test.js
│       ├── carbonForecastService.test.js
│       ├── impactTrackerService.test.js
│       └── geminiChatService.test.js
└── carbonwise-frontend/
    ├── .env.example
    ├── package.json
    └── src/
        ├── components/
        ├── context/AuthContext.jsx
        ├── pages/
        ├── services/api.js
        ├── App.jsx
        ├── index.css
        └── main.jsx
```

The backend service files contain the shared deterministic logic. In
particular, `carbonIntelligenceService.js` is the source of truth for activity
parsing, emission factors, comparisons, anomalies, recommendations, and
backend-owned activity emission calculation.

## 6. Architecture and workflow

```mermaid
flowchart LR
    U[User] --> R[React + Vite UI]
    R --> A[Axios API client]
    A --> E[Express API]
    E --> M[JWT auth middleware]
    M --> C[Controllers]
    C --> S[Deterministic services]
    S --> P[(PostgreSQL)]
    S --> J[Optional Gemini service]
    J --> K[(ai_response_cache)]
    C --> R
    S --> H[Chart/report response data]
```

Typical workflow:

1. A user registers or signs in and receives a JWT-backed authenticated
   session.
2. The frontend submits activity category and value to Express.
3. The backend validates the input and calculates emissions; the client cannot
   choose the persisted emission total.
4. Activity history is stored in PostgreSQL under the authenticated `user_id`.
5. Module services query only that user's records and return structured
   numerical results.
6. React renders cards, tables, charts, loading states, empty states, and
   errors.
7. Gemini is called only for eligible prose tasks. Numerical results are
   computed before any optional narrative request.

## 7. PostgreSQL setup and schema initialization

Install PostgreSQL and create an empty database, for example:

```sql
CREATE DATABASE carbonwise;
```

The backend reads `DATABASE_URL` and initializes missing tables at startup
through [`carbonwise-backend/src/models/schema.js`](carbonwise-backend/src/models/schema.js).
The initializer uses `CREATE TABLE IF NOT EXISTS` and does not drop or reset
existing tables or records.

Current tables are:

- `users`
- `activities`
- `scenarios`
- `coach_plans`
- `coach_actions`
- `coach_goals`
- `impact_baselines`
- `impact_reports`
- `ai_response_cache`

### Migration status and safe procedure

This repository currently has a non-destructive startup initializer, not a
numbered migration framework. For evaluation or local setup, starting the
backend is sufficient to create missing tables. For production schema changes:

1. Take and verify a PostgreSQL backup.
2. Test additive changes against a copy or isolated database.
3. Apply changes transactionally where possible.
4. Check foreign keys, indexes, and existing row counts.
5. Keep a documented rollback script for newly added objects.
6. Never drop or rewrite existing user activity data as part of enhancement.

## 8. Environment configuration

Copy the examples and replace placeholders locally. Do not commit `.env`
files or real credentials.

`carbonwise-backend/.env`:

```env
DATABASE_URL=postgresql://DB_USER:DB_PASSWORD@localhost:5432/carbonwise
JWT_SECRET=replace-with-a-long-random-secret
GEMINI_API_KEY=replace-with-your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_MS=12000
GEMINI_MAX_OUTPUT_TOKENS=320
GEMINI_CACHE_TTL_MS=86400000
GEMINI_RATE_LIMIT_PER_MINUTE=10
PG_SSL=false
PORT=5000
```

`carbonwise-frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

The API key is used only by the backend. The frontend must not contain
`GEMINI_API_KEY`, database credentials, or JWT secrets.

## 9. Run locally

### Backend

```powershell
cd carbonwise-backend
npm install
npm run dev
```

Production-style start:

```powershell
cd carbonwise-backend
npm start
```

The backend listens on port `5000` by default.

### Frontend

```powershell
cd carbonwise-frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

Production build and preview:

```powershell
cd carbonwise-frontend
npm run build
npm run preview
```

## 10. API endpoints

All endpoints below are prefixed with `http://localhost:5000/api`. Except for
health and registration/login, endpoints require `Authorization: Bearer <JWT>`.

### Authentication and health

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Backend health check |
| POST | `/auth/register` | Create a user |
| POST | `/auth/login` | Authenticate a user |
| GET | `/auth/me` | Return the authenticated user |

Example:

```bash
curl -X POST http://localhost:5000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"eco@example.com\",\"password\":\"replace-me\"}"
```

### Activities

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/activities` | Add an activity; backend calculates emissions |
| GET | `/activities` | List the authenticated user's activities |
| DELETE | `/activities/:id` | Delete the authenticated user's activity |

Example request body:

```json
{
  "activity_type": "transport",
  "details": {
    "value": 12,
    "unit": "km"
  },
  "date": "2026-10-11"
}
```

### Numerical and module APIs

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/intelligence?period=30` | Carbon intelligence analysis |
| POST | `/scenarios/preview` | Calculate an unsaved scenario |
| POST | `/scenarios` | Save a scenario |
| GET | `/scenarios` | List saved scenarios |
| GET | `/scenarios/:id` | Retrieve one owned scenario |
| PUT | `/scenarios/:id` | Update one owned scenario |
| DELETE | `/scenarios/:id` | Delete one owned scenario |
| POST | `/scenarios/compare` | Compare saved scenarios |
| GET | `/forecast?period=30&horizon=7` | Forecast and anomalies |
| POST | `/coach/plans` | Create a coach plan |
| GET | `/coach/plans` | List owned coach plans |
| GET | `/coach/plans/:id` | Retrieve one owned plan |
| PATCH | `/coach/actions/:actionId` | Update action status |
| GET | `/coach/goals` | List goals |
| POST | `/coach/goals` | Create a weekly/monthly goal |
| PATCH | `/coach/goals/:id` | Update a goal |
| POST | `/impact/baselines` | Create a baseline |
| GET | `/impact/baselines` | List baselines |
| POST | `/impact/reports` | Generate and save an impact report |
| GET | `/impact/reports` | List reports |
| GET | `/impact/reports/:id/pdf` | Export an owned report as PDF |

Example intelligence request:

```bash
curl "http://localhost:5000/api/intelligence?period=30" ^
  -H "Authorization: Bearer YOUR_JWT"
```

Example scenario preview:

```json
{
  "periodDays": 30,
  "changes": [
    {
      "action": "reduce",
      "category": "transport",
      "percentage": 20
    },
    {
      "action": "switch_transport",
      "category": "transport",
      "targetMode": "public_transport",
      "percentage": 50
    }
  ]
}
```

Only one change per category is accepted by the scenario validator, so the
example above is illustrative of supported change shapes; a real request must
combine transport assumptions into one supported change.

### Optional AI endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/ai/eco-plan` | Optional personalized Eco-Coach narrative |
| POST | `/api/chat` | Authenticated conversational response |
| GET | `/api/reports/monthly` | Legacy monthly report endpoint |
| GET | `/api/reports/insights` | Optional AI insights |
| GET | `/api/reports/predict` | Legacy narrative around estimates |
| GET | `/api/reports/pdf` | Legacy PDF report |

## 11. Carbon formulas and configured factors

The backend uses:

```text
emissions_kg = activity_value × emission_factor
```

Configured factors in
[`carbonIntelligenceService.js`](carbonwise-backend/src/services/carbonIntelligenceService.js)
are:

| Category | Unit | Factor |
|---|---:|---:|
| Transport | km | 0.21 kg CO₂/km |
| Electricity | kWh | 0.50 kg CO₂/kWh |
| Food | meal | 2.50 kg CO₂/meal |
| Flights | km | 0.255 kg CO₂/km |
| Shopping | item | 5.00 kg CO₂/item |

These are the application's configured default factors and are not presented
as universal or region-specific scientific benchmarks. The repository does
not currently include a formal external source citation for each factor.
Before production or academic benchmarking, replace or annotate them with
documented regional or institutional sources and record the factor version.

The backend rounds calculated and aggregated values to two decimal places.
Unsupported categories, non-finite values, and negative values are rejected.

## 12. What-If Simulator assumptions

The simulator:

- Uses the user's valid recorded activities as the baseline.
- Applies requested percentage changes to category totals.
- Supports reductions from 0% through 100%.
- Supports transport mode switching to car, public transport, cycling, or
  walking.
- Uses configured transport-mode factors of 0.21, 0.08, 0, and 0 kg CO₂/km,
  respectively.
- Does not alter, insert, or delete records in `activities`.
- Returns `isEstimate: true` and an assumptions list.

Potential savings are modeled differences, not verified reductions. The
simulator does not model rebound effects, seasonality, behavior quality,
measurement error, or interactions between lifestyle changes.

## 13. Forecasting and anomaly limitations

Forecasting uses a trailing seven-day moving-average baseline. It projects the
same recent daily average into a requested seven-day or 30-day horizon. A
weekly forecast requires at least three observed emission days; a monthly
forecast requires at least fourteen observed emission days.

Anomalies use a transparent rule based on the historical mean, standard
deviation, and a 1.5x mean minimum threshold. The forecast response includes
the affected date, leading category, baseline, threshold, explanation, and
related records.

These are explainable baselines, not machine-learning predictions. They do not
account for seasonality, holidays, planned travel, future behavior, missing
records, or causal relationships. Forecasts are estimates and are never
guarantees.

## 14. Eco-Coach personalization logic

The deterministic coach:

1. Parses valid activity records.
2. Builds the recent intelligence period.
3. Ranks the user's largest emission categories.
4. Selects category-specific action templates.
5. Estimates potential savings using the category reduction rate configured in
   the shared factor table.
6. Uses prior completed action counts to vary fallback wording and encourage
   consistency.

Plans, actions, goals, statuses, and completion timestamps are stored with
ownership checks. Completion is tracked as behavior history; it is not treated
as evidence that emissions fell. Gemini can provide optional prose, but it
does not calculate the plan's numerical values.

## 15. Impact tracking and reporting methodology

An impact baseline stores a named period and its recorded emissions. A report
then calculates:

```text
absolute_change = current_emissions - baseline_emissions
percentage_change = absolute_change / baseline_emissions × 100
```

When the baseline is zero, the percentage is represented safely as `null`
unless both values are zero, in which case the status is `unchanged`.

Reports include current and baseline totals, status, category breakdown,
trends, goal/action fields, and modeled potential savings. Potential savings
are kept separate from observed recorded changes. Optional Gemini narratives
are constrained not to claim that an action caused a reduction.

## 16. Gemini integration, caching, and quota handling

Gemini is intentionally not used for calculations, aggregation, scenario
arithmetic, forecasting, anomaly detection, or goal arithmetic. It is used
only for eligible natural-language tasks such as coaching prose, chat,
insights, and optional report narratives.

The shared service in
[`geminiChatService.js`](carbonwise-backend/src/services/geminiChatService.js):

- Keeps the API key on the backend.
- Uses the configured `gemini-2.5-flash` default unless overridden.
- Builds SHA-256 cache keys from normalized user/task/input data, prompt
  version, model ID, and data version.
- Stores responses in `ai_response_cache` with an expiration time.
- Joins identical in-flight requests.
- Applies a per-user per-minute rate limit.
- Bounds timeouts and output tokens.
- Avoids repeated retries after quota/429 errors.
- Provides deterministic fallback text for missing keys, timeouts, quota
  failures, network errors, and malformed responses.
- Logs task, cache status, latency, and error category without logging API
  credentials or prompt-private activity details.

To verify caching manually, call the same authenticated AI operation twice
with unchanged activity data and prompt inputs. The second request should
reuse the PostgreSQL cache entry and backend logs should show
`cache_hit=true`. Dashboard numerical rendering does not require Gemini.

## 17. Testing and actual results

Run backend tests:

```powershell
cd carbonwise-backend
npm test
```

The configured backend test command runs seven test files. The last recorded
result was:

```text
23 tests passed
0 tests failed
```

Run frontend checks:

```powershell
cd carbonwise-frontend
npm run lint
npm run build
```

The last recorded production build passed. The last recorded lint run still
reported **17 errors and 4 warnings**, primarily in existing frontend
components and hook patterns. There is no configured TypeScript type-check
script.

Additional recorded validation:

- Backend syntax checks passed for changed JavaScript files.
- PostgreSQL read-only connectivity check passed.
- Backend health returned HTTP 200.
- Unauthenticated protected endpoints returned HTTP 401.
- Invalid authentication inputs returned HTTP 400.
- Schema inspection found 9 application tables, 10 foreign keys, and 11
  indexes.
- No valid registration/login workflow was run against the configured database,
  because doing so would create persistent test data without a disposable
  test database.
- No live Gemini request was made; Gemini behavior was tested with mocked SDK
  behavior.
- A browser mobile check detected a small landing-page horizontal-overflow
  condition that should be cleaned up.

## 18. Known limitations and future enhancements

- Replace startup table initialization with numbered, reviewed, additive
  migrations and explicit rollback scripts.
- Add an isolated HTTP integration-test database for full registration,
  login, cross-user ownership, and end-to-end workflows.
- Resolve the remaining frontend ESLint errors and warnings.
- Add a formal factor-source/version registry for regional emission factors.
- Improve mobile landing-page sizing and run a broader responsive test matrix.
- Wire the shared header reporting-period selector to global module state.
- Add a dedicated Sustainability Goals route instead of sharing
  `/action-plan`.
- Add stronger observability with request IDs and sanitized structured logs.
- Improve forecast models only after enough high-quality historical data is
  available.
- Add accessibility and PDF regression tests.

## Viva voce preparation

### How are carbon emissions calculated in the backend?

The client submits a category and activity value. The backend validates both,
looks up the category in the shared emission-factor table, and calculates
`value × factor`. The persisted `carbon_emissions` value is therefore owned by
the backend rather than trusted from the browser.

### Why is PostgreSQL used?

PostgreSQL provides relational integrity, parameterized queries, foreign keys,
ownership relationships, JSONB for flexible activity/scenario details, and
durable storage for users, activities, goals, plans, reports, and AI cache
entries. It also supports indexed period queries and safe constraints.

### How does React `useState` work here?

Components use `useState` to hold values such as form fields, fetched API
responses, loading flags, errors, selected periods, and saved scenarios.
Calling a state setter schedules a re-render, so the UI reflects the latest
value without manually changing the DOM. Effects and event handlers trigger
API calls while state controls loading and empty states.

### How does React communicate with Express?

React uses the shared Axios client in `src/services/api.js`. It sends HTTP
requests to the Express `/api` routes, includes the JWT for protected
endpoints, receives JSON responses, and stores those responses in component
state for cards, tables, and Chart.js visualizations.

### How does the intelligence engine identify major emission sources?

It filters valid records for the selected period, sums emissions by category,
computes each category's contribution percentage, and sorts categories by
emissions. The largest entries become the largest-source list and inform
recommendation ranking.

### How do scenario simulations work?

The simulator copies the user's valid activity totals into an in-memory
baseline, validates each hypothetical change, applies the reduction or
transport-mode factor, and returns a new scenario total and difference. It
never edits actual activity rows.

### How is forecasting different from actual measurement?

Actual values come from recorded PostgreSQL activities. Forecast values are
future estimates generated by the trailing seven-day moving average. The UI
and API keep actual and projected arrays separate, and the response states the
method, horizon, assumptions, and insufficiency limitations.

### How does the Eco-Coach adapt to user progress?

It uses the user's highest-impact categories and prior completed action
history. The persisted action status and completion timestamp provide feedback
for later plans. This indicates behavioral progress, but the system does not
claim causation unless recorded emissions independently show a change.

### How does Gemini caching reduce unnecessary requests?

The service normalizes the task input and combines it with user ID, prompt
version, model, and data version to create a cache key. A valid PostgreSQL
cache entry avoids a new Gemini request. Identical concurrent requests share
one in-flight promise, and per-user rate limits prevent excessive refreshes.

### How do the five modules work together?

Activity History supplies backend-calculated records. Carbon Intelligence
aggregates them and identifies sources. The What-If Simulator models possible
changes without altering those records. Eco-Coach turns the sources into
actions and goals. Forecasting estimates future values from history. Impact
Tracker compares recorded periods and reports progress. Optional Gemini prose
explains these results but does not replace the numerical engine.

### What makes CarbonWise AI more than a basic carbon calculator?

It preserves a user's history, explains category drivers, compares equivalent
periods, detects unusual values, models hypothetical choices, adapts action
plans, tracks goals and baselines, generates reports, and clearly separates
observed measurements from estimates and forecasts. That makes it an
analytics and decision-support workflow rather than a one-time calculator.

## License and academic use

This repository is configured as an academic/project application. Review the
root `package.json` files and repository history for the exact dependency and
license metadata before external redistribution.
