#!/usr/bin/env ts-node
/**
 * Health Tourism AI Platform – DB Seeder
 * Populates PostgreSQL with realistic health tourism data
 */

import { Client } from "pg";
// @ts-ignore
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  try {
    await client.connect();
    console.log("🌍 Connected to PostgreSQL");

    // 1️⃣ Insert Patients
    await client.query(`
      INSERT INTO patients (full_name, email, country, language, phone, created_at)
      VALUES
      ('John Doe', 'john.doe@gmail.com', 'United Kingdom', 'en', '+44-7700-900321', NOW()),
      ('Aisha Khan', 'aisha.khan@healthmail.com', 'United Arab Emirates', 'ar', '+971-52-123-4567', NOW()),
      ('Markus Steiner', 'markus.s@austriamail.at', 'Austria', 'de', '+43-660-555-1212', NOW())
      ON CONFLICT DO NOTHING;
    `);
    console.log("✅ Patients seeded");

    // 2️⃣ Insert Providers (Hospitals / Clinics)
    await client.query(`
      INSERT INTO providers (name, specialization, country, city, accreditation, contact_email, created_at)
      VALUES
      ('Medicana International Istanbul', 'Cardiology', 'Turkey', 'Istanbul', 'JCI', 'contact@medicana.com.tr', NOW()),
      ('Acibadem Healthcare Group', 'Orthopedics', 'Turkey', 'Ankara', 'ISO 9001', 'info@acibadem.com.tr', NOW()),
      ('American Hospital Istanbul', 'Oncology', 'Turkey', 'Istanbul', 'JCI', 'info@amerikanhastanesi.org', NOW())
      ON CONFLICT DO NOTHING;
    `);
    console.log("✅ Providers seeded");

    // 3️⃣ Insert Treatment Packages
    await client.query(`
      INSERT INTO catalog_packages (title, description, base_price_usd, currency, duration_days, provider_id)
      VALUES
      ('Heart Bypass Surgery Package', 'Full cardiac bypass with 5-day hospitalization and 7-day hotel recovery.', 13500, 'USD', 12, 1),
      ('Knee Replacement Program', 'Bilateral knee replacement with physiotherapy follow-up.', 8900, 'USD', 10, 2),
      ('Liver Transplant Evaluation', 'Comprehensive pre-surgery evaluation and transplant eligibility assessment.', 5000, 'USD', 7, 3)
      ON CONFLICT DO NOTHING;
    `);
    console.log("✅ Treatment packages seeded");

    // 4️⃣ Insert Example Booking Case
    await client.query(`
      INSERT INTO cases (patient_id, provider_id, package_id, status, created_at)
      VALUES (1, 1, 1, 'IN_PROGRESS', NOW())
      ON CONFLICT DO NOTHING;
    `);
    console.log("✅ Example case added");

    console.log("🎉 Database seeded successfully");
  } catch (err) {
    console.error("❌ Error during seed operation:", err);
  } finally {
    await client.end();
    console.log("🔒 Connection closed");
  }
}

seed();