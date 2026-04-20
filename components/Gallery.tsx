// File: components/Gallery.tsx
// Execution Context: Must be explicitly marked as a Client Component in Next.js App Router.
'use client'; 

import React, { useState, useEffect } from 'react';
import { ProjectData, SearchResponse } from '../types/portfolio';
import { portfolioProjects } from '../lib/data';

// --- Sub-component: Project Card ---
// Separating the card logic ensures modularity, prevents massive re-renders, and improves React Virtual DOM reconciliation.
const ProjectCard = ({ project }: { project: ProjectData }) => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl overflow-hidden transition-all duration-300 hover:-translate-y-2 border border-gray-100 dark:border-gray-700 flex flex-col h-full">
    <div className="h-52 bg-gray-200 dark:bg-gray-700 relative overflow-hidden group">
      {/* Fallback image strategy prevents broken asset links from degrading the UI presentation */}
      <img 
        src={project.imageUrl} 
        alt={`Visual representation of ${project.title}`} 
        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
        onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/600x400?text=Project+Asset+Unavailable'; }}
      />
    </div>
    <div className="p-6 flex flex-col flex-grow">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 leading-tight">{project.title}</h3>
      <p className="text-gray-600 dark:text-gray-300 text-base mb-6 flex-grow leading-relaxed">
        {project.description}
      </p>
      <div className="flex flex-wrap gap-2 mb-6">
        {project.technologies.map((tech) => (
          <span key={tech} className="px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-bold tracking-wide rounded-full border border-blue-100 dark:border-blue-800">
            {tech}
          </span>
        ))}
      </div>
      <div className="flex gap-4 mt-auto border-t border-gray-100 dark:border-gray-700 pt-4">
        {project.githubUrl && (
          <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0.84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0.268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
            Source Code
          </a>
        )}
        {project.liveUrl && (
          <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors flex items-center gap-1 ml-auto">
            View Live Deployment
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </a>
        )}
      </div>
    </div>
  </div>
);

// --- Main Component: Intelligent Gallery ---
export default function Gallery() {
  const [query, setQuery] = useState("");
  const = useState<ProjectData>(portfolioProjects);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core execution function for bridging client to server
  const executeAISearch = async (searchStr: string) => {
    // Immediate short-circuit: If input is cleared, reset gallery instantly without API call.
    if (!searchStr.trim()) {
      setDisplayedProjects(portfolioProjects);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/gallery-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchStr }),
      });

      const data: SearchResponse = await response.json();

      // Intercept and handle logical or HTTP errors returned by the orchestration layer.
      if (!response.ok ||!data.success) {
        throw new Error(data.error |

| `HTTP Negotiation Failed: Status ${response.status}`);
      }

      // Rehydrate the full project objects based on the mathematical ID mapping returned by the AI.
      const matchedProjects = portfolioProjects.filter(p => data.matchedIds.includes(p.id));
      
      setDisplayedProjects(matchedProjects);

      // Handle the semantic edge case where AI processed successfully but identified zero matches.
      if (matchedProjects.length === 0) {
        setError("The AI analysis completed, but no projects within the portfolio match your highly specific criteria. Please attempt a broader semantic query.");
      }

    } catch (err: any) {
      console.error("AI Interface Synchronization Error:", err);
      setError(err.message |

| "Network synchronization failed. Unable to establish connection with the AI Inference Engine.");
      // Deliberately clear results on error to prevent presenting functionally stale or inaccurate data to the user.
      setDisplayedProjects(); 
    } finally {
      // Regardless of success or catastrophic failure, the loading state must strictly resolve to false.
      setIsLoading(false);
    }
  };

  // Implementation of Cryptographic-grade Debouncing
  // This hook manages the temporal flow of user input, preventing API rate-limit saturation.
  useEffect(() => {
    // Initialize a timeout buffer
    const delayDebounceFn = setTimeout(() => {
      // Execution only proceeds if the user has ceased typing for 500 milliseconds.
      if (query.trim()!== "") {
        executeAISearch(query);
      } else {
        // Reset state if backspaced to empty
        setDisplayedProjects(portfolioProjects);
        setError(null);
      }
    }, 500);

    // Cleanup function: If the user types again before 500ms, the previous timeout is mathematically destroyed.
    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <section className="w-full max-w-7xl mx-auto px-4 py-20 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl tracking-tight">
          Intelligent Project Discovery
        </h2>
        <p className="mt-5 text-xl text-gray-500 dark:text-gray-400 max-w-3xl mx-auto">
          Utilize natural language to navigate the engineering portfolio. Describe your technical requirements, and the embedded deterministic AI will instantly curate the exact architectural implementations you need to review.
        </p>
      </div>

      {/* Primary User Input Interface */}
      <div className="relative max-w-3xl mx-auto mb-16">
        <div className={`relative flex items-center w-full h-16 rounded-2xl focus-within:shadow-2xl focus-within:ring-2 focus-within:ring-blue-500 bg-white dark:bg-gray-800 overflow-hidden border-2 transition-all duration-300 ${error? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'}`}>
          <div className="grid place-items-center h-full w-16 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <input
            className="peer h-full w-full outline-none text-lg text-gray-800 dark:text-gray-100 pr-12 bg-transparent font-medium placeholder-gray-400"
            type="text"
            id="ai-search-input"
            aria-label="Search portfolio projects using AI"
            placeholder="e.g., 'Show me full-stack React applications' or 'Docker configurations'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading} // Prevent compounding input while a request is in flight
          /> 
          
          {/* Dynamic Visual Feedback Protocol (Loading Spinner) */}
          {isLoading && (
            <div className="absolute right-5 grid place-items-center">
              <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-label="Processing query">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}
        </div>
        
        {/* Error State Typographic Display */}
        {error && (
          <div className="absolute -bottom-10 left-0 w-full text-center animate-fade-in">
            <p className="text-red-500 dark:text-red-400 font-semibold text-sm bg-red-50 dark:bg-red-900/20 py-1 px-4 rounded-full inline-block border border-red-100 dark:border-red-800">
              ⚠️ {error}
            </p>
          </div>
        )}
      </div>

      {/* Asynchronous Rendering Grid Layout */}
      <div 
        className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 transition-opacity duration-500 ease-in-out ${isLoading? 'opacity-40 grayscale-[20%]' : 'opacity-100 grayscale-0'}`}
        aria-live="polite" // Enhances screen reader accessibility during DOM updates
      >
        {displayedProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}
