// File: types/portfolio.ts
// Purpose: Establishes a strict type contract across the full stack to prevent Vercel build failures.

export interface ProjectData {
  id: string;
  title: string;
  description: string;
  technologies: string;
  imageUrl: string;
  liveUrl?: string; // Optional property denoted by '?'
  githubUrl?: string;
}

export interface SearchResponse {
  success: boolean;
  matchedIds: string;
  message?: string;
  error?: string;
}
