require('dotenv').config();
const mongoose = require('mongoose');
const { createClient } = require('redis');

const logSchema = new mongoose.Schema({
  level: String,
  message: String,
  source: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

logSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 3600 }
);

const Log = mongoose.model('Log', logSchema);

const redisClient = createClient({
  url: process.env.REDIS_URL
});

redisClient.on('error', (err) => {
  console.error('Redis Error:', err);
});

const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 500;

let batch = [];
let flushTimer = null;
let isFlushing = false;

async function flushBatch() {
  if (isFlushing) return;
  if (batch.length === 0) return;

  isFlushing = true;

  const dataToInsert = [...batch];
  batch = [];

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  try {
    await Log.insertMany(dataToInsert, {
      ordered: false
    });

    console.log(`✔ Flushed ${dataToInsert.length} logs`);
  } catch (err) {
    console.error('Mongo batch insert error:', err);
  } finally {
    isFlushing = false;
  }
}

function scheduleFlush() {
  if (flushTimer || batch.length === 0) return;

  flushTimer = setTimeout(async () => {
    await flushBatch();
    flushTimer = null;
  }, FLUSH_INTERVAL);
}

async function processLogs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    await redisClient.connect();

    console.log('✔ Worker connected to MongoDB and Redis');

    while (true) {
      const result = await redisClient.brPop(
        ['log_queue'],
        1
      );

      if (!result) {
        scheduleFlush();
        continue;
      }

      try {
        const log = JSON.parse(result.element);

        batch.push(log);

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        } else {
          scheduleFlush();
        }

      } catch (parseError) {
        console.error('Log parse error:', parseError);
      }
    }

  } catch (err) {
    console.error('Worker crashed:', err);
    process.exit(1);
  }
}

async function shutdown() {
  console.log('\n⚠ Shutting down worker...');

  try {
    await flushBatch();

    await redisClient.quit();

    await mongoose.connection.close();

    console.log('✔ Worker shutdown complete');

    process.exit(0);
  } catch (err) {
    console.error('Shutdown error:', err);
    process.exit(1);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

processLogs();