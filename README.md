🐧 Penguin: AI English Communication Coach

Penguin is a full-stack, AI-powered voice assistant designed to help non-native speakers practice and improve their spoken English. By leveraging the Google Gemini API, Penguin listens to user audio input, analyzes the speech, and provides real-time, actionable feedback on grammar, vocabulary, and pronunciation.

🚀 Key Features

Dynamic Audio Visualization: Custom HTML5 <canvas> integration using the Web Audio API to render real-time frequency waves reacting to user speech.

AI-Powered Feedback: Direct integration with Google's Gemini 3.5 Flash API to analyze multimodal data (audio) and return structured corrections.

Resilient Architecture: Enterprise-grade API communication featuring Exponential Backoff and automated retry logic to handle high-traffic 503 errors gracefully.

Conversation Management: Full CRUD capabilities for conversation histories, featuring cascading database deletes and seamless state updates.

Secure Authentication: Custom JWT-based stateless authentication backed by Spring Security.

💻 Tech Stack

Frontend:

React 19 & Next.js 15 (App Router)

Tailwind CSS (Custom Dark Theme: #0b0909, #2e4540, #408175, #b5b9f0)

TypeScript

Web Audio API

Backend:

Java 21 & Spring Boot 3.4

PostgreSQL & Hibernate (JPA)

Spring Security & JWT

GraalVM Native Image Support

AI & Cloud:

Google Gemini API (Generative AI)

🛠️ Local Setup Instructions

Prerequisites

Node.js (v18+)

Java 21 (JDK)

PostgreSQL installed and running locally

Google Gemini API Key

Backend Setup

Navigate to the backend-api directory.

Create a .env file (or set environment variables) and add your database credentials and API key:

GEMINI_API_KEY=your_google_api_key_here
DB_URL=jdbc:postgresql://localhost:5432/penguin_db
DB_USER=your_username
DB_PASSWORD=your_password


Run the Spring Boot application:

mvn clean spring-boot:run


Frontend Setup

Navigate to the frontend-web directory.

Install dependencies:

npm install


Start the Next.js development server:

npm run dev


Open your browser and visit http://localhost:3000.

🧠 What I Learned

Building Penguin involved navigating complex challenges at the intersection of browser APIs and backend multi-threading. Major learnings included bypassing strict Next.js SSR hydration crashes when implementing the Web Audio API, configuring Spring Security filters to safely handle streaming multipart/form-data blobs alongside standard REST calls, and building resilient API architectures that can survive remote traffic limitations.