# CarbonWise AI

CarbonWise AI is a unified Full-Stack platform bringing data analytics and Generative AI together to interpret personal carbon footprints.

## Project Structure
- `carbonwise-frontend/` - Contains the React app (built with Vite) and the premium UI pages.
- `carbonwise-backend/` - Contains the Express.js API, PostgreSQL integrations, and Gemini AI routes.

## How to Run Locally

### 1. Database Setup
1. Download and install PostgreSQL.
2. Create a database named `carbonwise` or your preferred name.
3. Open `carbonwise-backend/.env` and update `DATABASE_URL` with your credentials:
   `postgres://username:password@localhost:5432/carbonwise`

### 2. API Keys
1. Get a Gemini API key from Google AI Studio.
2. Add it to `carbonwise-backend/.env` under `GEMINI_API_KEY`.

### 3. Start Backend
```bash
cd carbonwise-backend
npm run dev
```
(On start, the backend will automatically initialize the required PostgreSQL tables `users` and `activities`).

### 4. Start Frontend
```bash
cd carbonwise-frontend
npm run dev
```
Open `http://localhost:5173` in your browser.
