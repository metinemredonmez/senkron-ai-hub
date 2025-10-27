#!/usr/bin/env ts-node
/**
 * Health Tourism AI Platform — Cache Cleaner
 * Clears Redis and Qdrant caches safely with confirmation logs
 */

import Redis from "ioredis";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const redis = new Redis(process.env.REDIS_URL!);
const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";
const qdrantCollections = [
  "treatment_packages",
  "patient_profiles",
  "medical_guidelines",
];

async function clearCaches() {
  try {
    console.log("🧭 Starting cache cleanup...");

    // Redis flush
    await redis.flushall();
    console.log("✅ Redis cache fully cleared");

    // Qdrant cleanup (delete all vectors)
    for (const col of qdrantCollections) {
      try {
        await axios.post(`${qdrantUrl}/collections/${col}/points/delete`, {
          filter: {},
        });
        console.log(`✅ Qdrant collection cleared: ${col}`);
      } catch (e) {
        console.warn(`⚠️ Skipped Qdrant collection (not found): ${col}`);
      }
    }

    console.log("🎉 All cache stores cleared successfully");
  } catch (err) {
    console.error("❌ Error clearing cache:", err);
  } finally {
    redis.disconnect();
  }
}

clearCaches();