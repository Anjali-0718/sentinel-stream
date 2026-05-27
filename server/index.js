require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const mongoose = require('mongoose');
const { z } = require('zod');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

const CLIENT_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5175"
];

app.use(cors({
  origin: CLIENT_ORIGINS,
  methods: ["GET", "POST"],
}));

app.use(express.json({ limit: "1mb" }));

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGINS,
    methods: ["GET", "POST"],
  },
  transports: ["websocket"],
});

const redisClient = createClient({ url: process.env.REDIS_URL });

redisClient.on('error', (err) => {
  console.error('Redis Error:', err);
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("DB Connected"))
  .catch(err => console.error("DB Connection Error:", err));

const logSchema = z.object({
  level: z.enum(['INFO', 'WARN', 'ERROR', 'CRITICAL']),
  message: z.string().min(1),
  source: z.string().default("unknown"),
  timestamp: z.string().optional(),
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
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', key, 0, window)

local count = redis.call('ZCARD', key)

if count >= limit then
  return -1
end

redis.call('ZADD', key, now, now)
redis.call('EXPIRE', key, 60)

return limit - count - 1
`;

function getIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]
    || req.socket.remoteAddress;
}

async function rateLimiter(req, res, next) {
  const ip = getIP(req);
  const key = `rl:${ip}`;

  const LIMIT = 100;
  const WINDOW = 60000;

  const now = Date.now();
  const windowStart = now - WINDOW;

  try {
    const remaining = await redisClient.eval(slidingWindowLua, {
      keys: [key],
      arguments: [
        now.toString(),
        windowStart.toString(),
        LIMIT.toString()
      ]
    });

    res.setHeader('X-RateLimit-Limit', LIMIT);

    if (remaining === -1) {
      res.setHeader('X-RateLimit-Remaining', 0);
      return res.status(429).json({
        error: 'Rate limit exceeded'
      });
    }

    res.setHeader('X-RateLimit-Remaining', remaining);
    next();

  } catch (err) {
    console.error("Rate limiter error:", err);
    next();
  }
}

app.get('/logs', async (req, res) => {
  try {
    const logs = await Log.find({})
      .sort({ timestamp: -1 })
      .limit(500)
      .lean();

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

app.get('/queue-size', async (req, res) => {
  try {
    const size = await redisClient.lLen('log_queue');
    res.json({ size });
  } catch (err) {
    res.status(500).json({ error: 'Queue fetch failed' });
  }
});

app.post('/ingest', rateLimiter, async (req, res) => {
  const apiKey = req.headers['x-api-key'];

  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const log = logSchema.parse(req.body);

    io.emit('new-log', log);

    redisClient.lPush('log_queue', JSON.stringify(log))
      .catch(err => console.error("Redis push error:", err));

    res.status(202).json({ status: 'accepted' });

  } catch (err) {
    res.status(400).json({ error: 'Invalid payload' });
  }
});

async function start() {
  try {
    await redisClient.connect();

    server.listen(PORT, () => {
      console.log(`Server running on ${PORT}`);
    });

  } catch (err) {
    console.error("Startup failed:", err);
    process.exit(1);
  }
}

start();