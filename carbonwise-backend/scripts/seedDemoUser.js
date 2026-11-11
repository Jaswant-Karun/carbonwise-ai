require('dotenv').config();
const db = require('../src/config/db');
const bcrypt = require('bcrypt');

async function seed() {
  try {
    const hash = await bcrypt.hash('Password123!', 10);
    const existing = await db.query('SELECT id FROM users WHERE email = $1', ['demo@carbonwise.ai']);
    if (existing.rows.length > 0) {
      await db.query('UPDATE users SET password = $1 WHERE email = $2', [hash, 'demo@carbonwise.ai']);
      console.log('✅ Demo user password updated in PostgreSQL:', existing.rows[0].id);
    } else {
      const res = await db.query(
        'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id',
        ['Sustainability Ambassador', 'demo@carbonwise.ai', hash]
      );
      console.log('✅ Demo user created in PostgreSQL:', res.rows[0].id);
    }

    // Also ensure demo user has a default environmental region
    const userRes = await db.query('SELECT id FROM users WHERE email = $1', ['demo@carbonwise.ai']);
    const userId = userRes.rows[0].id;

    const reg = await db.query('SELECT id FROM environment_regions WHERE user_id = $1', [userId]);
    if (reg.rows.length === 0) {
      await db.query(
        `INSERT INTO environment_regions (user_id, name, latitude, longitude, country, admin1, timezone)
         VALUES ($1, 'New York, USA', 40.7128, -74.0060, 'United States', 'New York', 'America/New_York')`,
        [userId]
      );
      console.log('✅ Default region added for demo user.');
    }

    // Also add sample activities if none exist
    const act = await db.query('SELECT id FROM activities WHERE user_id = $1', [userId]);
    if (act.rows.length === 0) {
      await db.query(
        `INSERT INTO activities (user_id, activity_type, details, carbon_emissions, date)
         VALUES 
         ($1, 'electricity', '{"value": 120, "unit": "kWh"}', 60.0, CURRENT_DATE - INTERVAL '1 day'),
         ($1, 'transport', '{"value": 45, "unit": "km"}', 9.45, CURRENT_DATE - INTERVAL '2 days'),
         ($1, 'food', '{"value": 3, "unit": "meals"}', 7.5, CURRENT_DATE - INTERVAL '3 days'),
         ($1, 'water', '{"value": 4, "unit": "m³"}', 1.4, CURRENT_DATE - INTERVAL '4 days'),
         ($1, 'facilities', '{"value": 50, "unit": "kWh"}', 25.0, CURRENT_DATE - INTERVAL '5 days')`,
        [userId]
      );
      console.log('✅ Sample carbon activities seeded for demo user.');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to seed demo user:', err);
    process.exit(1);
  }
}

seed();

