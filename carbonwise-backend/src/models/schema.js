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

  try {
    await db.query(createUsersTable);
    await db.query(createActivitiesTable);
    console.log('✅ Database tables initialized successfully');
  } catch (err) {
    console.error('❌ Error initializing database tables:', err.stack);
  }
};

module.exports = { initDb };
