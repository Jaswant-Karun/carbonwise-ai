const db = require('../config/db');

// Creates necessary tables if they don't exist
const initDb = async () => {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
//Added new Activity
  const createActivitiesTable = `
    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      activity_type VARCHAR(50) NOT NULL, -- e.g., 'transport', 'electricity', 'food'
      details JSONB NOT NULL,
      carbon_emissions DECIMAL(10, 2) NOT NULL, -- in kg CO2
      date DATE DEFAULT CURRENT_DATE
    );
  `;

  const createScenariosTable = `
    CREATE TABLE IF NOT EXISTS scenarios (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      period_days INTEGER NOT NULL CHECK (period_days BETWEEN 1 AND 365),
      changes JSONB NOT NULL,
      baseline_emissions DECIMAL(10, 2) NOT NULL CHECK (baseline_emissions >= 0),
      scenario_emissions DECIMAL(10, 2) NOT NULL CHECK (scenario_emissions >= 0),
      potential_savings_kg DECIMAL(10, 2) NOT NULL CHECK (potential_savings_kg >= 0),
      potential_savings_percentage DECIMAL(6, 2) NOT NULL CHECK (potential_savings_percentage >= 0),
      assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await db.query(createUsersTable);
    await db.query(createActivitiesTable);
    await db.query(createScenariosTable);
    console.log('✅ Database tables initialized successfully');
  } catch (err) {
    console.error('❌ Error initializing database tables:', err.stack);
  }
};

module.exports = { initDb };
