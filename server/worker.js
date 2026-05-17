require('dotenv').config();
const mongoose = require('mongoose');
const { createClient } = require('redis');

const logSchema = new mongoose.Schema({
    level: String,
    message: String,
    source: String,
    timestamp: { type: Date, default: Date.now }
});

logSchema.index({ timestamp: 1 }, { expireAfterSeconds: 3600 });

const Log = mongoose.model('Log', logSchema);

const redisClient = createClient({ url: process.env.REDIS_URL });

const BATCH_SIZE = 100;
const BATCH_TIMEOUT_MS = 500;

async function processLogs() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        await redisClient.connect();
        console.log("Worker connected to MongoDB and Redis with Batch Writing enabled...");

        let batch = [];
        let timeoutId = null;

        const flushBatch = async () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            if (batch.length === 0) return;

            const recordsToWrite = [...batch];
            batch = [];

            try {
                await Log.insertMany(recordsToWrite, { ordered: false });
                console.log(`[BATCH FLUSHED]: Successfully saved ${recordsToWrite.length} logs to MongoDB.`);
            } catch (err) {
                if (err.name === 'BulkWriteError') {
                    console.error(`Bulk write partial failure. Inserted: ${err.result.nInserted} records.`);
                } else {
                    console.error('Failed to flush batch to MongoDB:', err);
                }
            }
        };

        while (true) {
            const result = await redisClient.brPop('log_queue', 1);

            if (!result) {
                if (batch.length > 0 && !timeoutId) {
                    timeoutId = setTimeout(flushBatch, BATCH_TIMEOUT_MS);
                }
                continue;
            }

            try {
                const logData = JSON.parse(result.element);
                batch.push(logData);

                if (batch.length >= BATCH_SIZE) {
                    await flushBatch();
                } else if (!timeoutId) {
                    timeoutId = setTimeout(flushBatch, BATCH_TIMEOUT_MS);
                }
            } catch (parseError) {
                console.error("Failed to parse log entry:", parseError);
            }
        }
    } catch (error) {
        console.error("Worker Error:", error);
    }
}

processLogs();