const axios = require('axios');

const API_URL = 'http://localhost:5000/ingest';
const API_KEY = 'sentinel_dev_key';

const sources = ['Auth-Service', 'Payment-Gateway', 'Inventory-Manager', 'User-Profile'];
const levels = ['INFO', 'WARN', 'ERROR', 'CRITICAL'];

const TOTAL_REQUESTS = 2000;
const CONCURRENCY = 50;

let success = 0;
let fail = 0;

function randomLog(i) {
  return {
    level: levels[Math.floor(Math.random() * levels.length)],
    message: `Stress test log ${i}`,
    source: sources[Math.floor(Math.random() * sources.length)]
  };
}

async function sendBatch(start, end) {
  const promises = [];

  for (let i = start; i < end; i++) {
    const fakeIp = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.0.1`;

    promises.push(
      axios.post(API_URL, randomLog(i), {
        headers: { 
          'x-api-key': API_KEY,
          'x-forwarded-for': fakeIp 
        },
        timeout: 5000
      })
      .then(() => success++)
      .catch(() => fail++)
    );
  }

  await Promise.all(promises);
}

async function runStressTest() {
  console.log("Starting REAL stress test...");
  const startTime = Date.now();

  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY) {
    await sendBatch(i, i + CONCURRENCY);
  }

  const endTime = Date.now();

  console.log("\n STRESS TEST RESULTS");
  console.log("----------------------");
  console.log("Total:", TOTAL_REQUESTS);
  console.log("Success:", success);
  console.log("Failed:", fail);
  console.log("Time:", (endTime - startTime) / 1000, "sec");
  console.log("Req/sec:", (TOTAL_REQUESTS / ((endTime - startTime) / 1000)).toFixed(2));
}

runStressTest();