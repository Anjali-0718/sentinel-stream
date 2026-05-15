SentinelStream: Distributed Log Ingestion System
SentinelStream is a high-performance, containerized log monitoring and ingestion system designed to handle high-concurrency data streams. By leveraging a decoupled architecture with Redis as a message broker and MongoDB for persistent storage, the system ensures that log ingestion remains non-blocking and scalable.

Key Features:
Decoupled Architecture: Uses a producer-consumer pattern to handle high-traffic log bursts without overloading the database.

Real-Time Processing: Integrated Redis queue for sub-millisecond log buffering.

Containerized Environment: Fully Dockerized stack for consistent deployment across any environment.

Automated Stress Testing: Includes a dedicated script to simulate high-load scenarios and verify system stability.

Tech Stack:
Frontend: React.js (Vite)

Backend: Node.js & Express

Database: MongoDB

Cache/Queue: Redis

Infrastructure: Docker & Docker Compose

System Architecture:
The system consists of four primary services:

Ingestion Server: A REST API that receives incoming logs and pushes them into a Redis List.

Redis Queue: Acts as a high-speed buffer to prevent data loss during traffic spikes.

Worker Service: A background process that pulls logs from Redis and persists them into MongoDB.

Dashboard: A React interface to visualize ingested logs in real-time.