require('dotenv').config();
const express = require('express');
const { createClient } = require('redis');
const { z } = require('zod');
const http = require('http'); 
const { Server } = require('socket.io'); 
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app); 

app.use(cors({
    origin: ["http://localhost:5173", "http://localhost:5175"], 
    methods: ["GET", "POST"]
}));

app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173", "http://localhost:5175"],
        methods: ["GET", "POST"]
    }
});

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (err) => console.log('Redis Client Error', err));

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("DB Connected"))
    .catch(err => console.error("DB Connection Error:", err));

const logSchema = z.object({
    level: z.enum(['INFO', 'WARN', 'ERROR', 'CRITICAL']),
    message: z.string().min(1),
    source: z.string(),
    timestamp: z.string().optional().default(() => new Date().toISOString()),
});

const Log = mongoose.model('Log', new mongoose.Schema({
    level: String,
    message: String,
    source: String,
    timestamp: { type: Date, default: Date.now }
}));

const slidingWindowLua = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local window_start = tonumber(ARGV[2])
    local limit = tonumber(ARGV[3])
    
    redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
    
    local current_requests = redis.call('ZCARD', key)
    
    if current_requests < limit then
        redis.call('ZADD', key, now, now)
        redis.call('EXPIRE', key, 65)
        return limit - current_requests - 1
    else
        return -1
    end
`;

async function slidingWindowRateLimiter(req, res, next) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const key = `rate_limit:${ip}`;
    
    const LIMIT = 100;         
    const WINDOW_SIZE_MS = 60000; 
    
    const now = Date.now();
    const windowStart = now - WINDOW_SIZE_MS;

    try {
        const remaining = await redisClient.eval(slidingWindowLua, {
            keys: [key],
            arguments: [now.toString(), windowStart.toString(), LIMIT.toString()]
        });

        res.setHeader('X-RateLimit-Limit', LIMIT);

        if (remaining === -1) {
            res.setHeader('X-RateLimit-Remaining', 0);
            return res.status(429).json({
                error: 'Too Many Requests',
                message: `You have exceeded the sliding window limit of ${LIMIT} logs per minute. Please try again shortly.`
            });
        }

        res.setHeader('X-RateLimit-Remaining', remaining);
        next();
    } catch (error) {
        console.error('Sliding Window Rate Limiter Error:', error);
        next(); 
    }
}

app.get('/logs', async (req, res) => {
    try {
        const logs = await Log.find().sort({ timestamp: -1 }).limit(500);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

app.get('/queue-size', async (req, res) => {
    try {
        const size = await redisClient.lLen('log_queue');
        res.json({ size });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch queue size' });
    }
});

app.post('/ingest', slidingWindowRateLimiter, async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const validatedLog = logSchema.parse(req.body);
        io.emit('new-log', validatedLog);
        await redisClient.lPush('log_queue', JSON.stringify(validatedLog));
        res.status(202).json({ status: 'Accepted', message: 'Log buffered in Redis' });
    } catch (error) {
        res.status(400).json({ error: 'Invalid log format' });
    }
});

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        await redisClient.connect();
        server.listen(PORT, () => {
            console.log(`Ingestion Server (Fast-Path) live on port ${PORT}`);
        });
    } catch (err) {
        console.error("Failed to start server:", err);
    }
}

startServer();