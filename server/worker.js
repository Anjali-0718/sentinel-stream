require('dotenv').config();
const mongoose = require('mongoose');
const { createClient } = require('redis');

// 1. Define the Permanent Storage Structure (Mongoose Schema)
const logSchema = new mongoose.Schema({
    level: String,
    message: String,
    source: String,
    timestamp: { type: Date, default: Date.now }
});

// Create a TTL index: Automatically delete logs after 7 days
logSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 });

const Log = mongoose.model('Log', logSchema);

// 2. Initialize Redis
const redisClient = createClient({ url: process.env.REDIS_URL });

async function processLogs() {
    try {
        // Connect to MongoDB and Redis
        await mongoose.connect(process.env.MONGO_URI);
        await redisClient.connect();
        console.log("Worker connected to MongoDB and Redis...");

        while (true) {
            // BRPOP: "Blocking Right Pop" 
            // It waits until a log is available in the queue
            const result = await redisClient.brPop('log_queue', 0);
            
            if (result) {
                const logData = JSON.parse(result.element);
                
                // Save to MongoDB
                const newLog = new Log(logData);
                await newLog.save();
                
                console.log(`[SAVED TO DB]: ${logData.level} from ${logData.source}`);
            }
        }
    } catch (error) {
        console.error("Worker Error:", error);
    }
}

processLogs();