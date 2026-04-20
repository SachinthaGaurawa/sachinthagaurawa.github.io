// File: lib/data.ts
// Purpose: Centralized data repository. Modifying this file automatically updates the entire site.

import { ProjectData } from '../types/portfolio';

export const portfolioProjects: ProjectData =,
    imageUrl: "/images/ecommerce-architecture.jpg",
    githubUrl: "https://github.com/SachinthaGaurawa/ecommerce-microservices"
  },
  {
    id: "proj-002",
    title: "AI-Powered Next.js Portfolio Architecture",
    description: "An innovative, fault-tolerant web application that utilizes deterministic machine learning models to automatically curate and present projects based on natural language queries.",
    technologies:,
    imageUrl: "/images/ai-portfolio-system.jpg",
    liveUrl: "https://sachinthagaurawa.github.io/"
  },
  {
    id: "proj-003",
    title: "Real-Time Distributed Chat Application",
    description: "A low-latency, globally distributed messaging application utilizing WebSockets and Redis caching for real-time bidirectional communication across thousands of concurrent clients.",
    technologies:,
    imageUrl: "/images/distributed-chat.jpg",
    githubUrl: "https://github.com/SachinthaGaurawa/realtime-chat"
  }
  // The developer can append an infinite number of projects here. 
  // The AI system dynamically adapts without requiring code changes.
];
