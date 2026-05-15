// stress_test.js
const axios = require('axios');

const API_URL = 'http://localhost:5000/ingest';
const API_KEY = 'sentinel_dev_key'; 

const sources = ['Auth-Service', 'Payment-Gateway', 'Inventory-Manager', 'User-Profile'];
const levels = ['INFO', 'WARN', 'ERROR', 'CRITICAL'];

async function sendLogs() {
    console.log("Starting Stress Test: Sending 100 logs...");
    
    for (let i = 0; i < 100; i++) {
        const log = {
            level: levels[Math.floor(Math.random() * levels.length)],
            message: `Automatic system check - Sequence ${i}`,
            source: sources[Math.floor(Math.random() * sources.length)]
        };

       await axios.post(API_URL, log, { headers: { 'x-api-key': API_KEY } })
            .catch(err => console.error("Failed to send log"));
            
        await new Promise(r => setTimeout(r, 80)); 
    }
    console.log("Stress Test Complete.");
}

sendLogs();