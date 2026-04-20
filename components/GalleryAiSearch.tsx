// @/components/GalleryAiSearch.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';

// Strict TypeScript interfaces defining the data contract
export interface PortfolioProject {
  id: string;
  title: string;
  description: string;
  technologies: string;
  imageUrl: string;
  githubUrl?: string;
  liveUrl?: string;
  relevanceScore?: number;
}

interface SearchApiResponse {
  results: PortfolioProject;
  error?: string;
}

export default function GalleryAiSearch() {
  // Complex state management matrix for asynchronous operations
  const = useState<string>('');
  const = useState<string>('');
  const [projects, setProjects] = useState<PortfolioProject>();
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Implement rigorous 500ms debouncing to prevent network saturation and Vercel edge timeouts
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500); 

    // Cleanup function clears the timeout if the user continues typing
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  // Asynchronous Search Execution Thread
  useEffect(() => {
    const executeIntelligentSearch = async () => {
      // Return to baseline state if query is empty
      if (!debouncedQuery.trim()) {
        setProjects();
        setErrorMessage(null);
        setIsProcessing(false);
        return;
      }

      setIsProcessing(true);
      setErrorMessage(null);

      try {
        // Utilizing absolute paths natively supported by browser window.fetch
        // This avoids the RSC relative path parsing errors entirely
        const response = await fetch('/api/intelligent-search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Implementation of standard security headers
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({ prompt: debouncedQuery }),
        });

        // Intercept non-200 HTTP statuses to prevent silent JSON parsing failures
        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload.error |

| `Server responded with status ${response.status}`);
        }

        const data: SearchApiResponse = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setProjects(data.results);
      } catch (err) {
        // Comprehensive error handling prevents the interface from freezing
        const diagnosticMessage = err instanceof Error? err.message : 'An unknown network disruption occurred.';
        setErrorMessage(`Search Analytics Disruption: ${diagnosticMessage}`);
        setProjects();
      } finally {
        setIsProcessing(false);
      }
    };

    executeIntelligentSearch();
  }, [debouncedQuery]);

  // Memoized event handler to prevent unnecessary re-renders of the input component
  const handleInputMutation = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  },);

  // UI Component Rendering
  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col space-y-10 font-sans">
      
      {/* Header and Input Matrix */}
      <div className="w-full max-w-3xl mx-auto text-center space-y-6">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Intelligent Project Repository
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Query the portfolio using natural language. The AI engine will semantically match your requirements against architectural implementations.
        </p>
        
        <div className="relative w-full shadow-sm rounded-2xl group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-300">
            <svg className={`h-6 w-6 ${isProcessing? 'text-blue-600 animate-pulse' : 'text-gray-400 group-focus-within:text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-12 py-5 border-2 border-gray-200 dark:border-gray-700 rounded-2xl leading-5 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-600 focus:ring-0 text-gray-900 dark:text-white sm:text-lg transition-all duration-300 ease-in-out"
            placeholder="e.g., 'Looking for secure blockchain identity solutions' or 'React Native apps'"
            value={searchQuery}
            onChange={handleInputMutation}
            aria-label="AI Portfolio Query Input"
          />
          
          {/* Hardware Accelerated Loading Indicator */}
          {isProcessing && (
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Error Boundary Rendering */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg w-full max-w-3xl mx-auto transform transition-all duration-300">
          <div className="flex">
            <div className="flex-shrink-0">
               <svg className="h-5 w-5 text-red-500 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Grid Output with Opacity Transitions for Loading States */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 transition-opacity duration-500 ease-in-out ${isProcessing? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
        {projects.length > 0? (
          projects.map((project) => (
            <article key={project.id} className="flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl overflow-hidden transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 dark:border-gray-700">
              <div className="h-56 bg-gray-200 dark:bg-gray-700 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 flex items-end p-4">
                  {project.liveUrl && (
                    <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="text-white text-sm font-semibold hover:underline">View Live Deployment →</a>
                  )}
                </div>
                {/* Fallback styling for images to ensure layout integrity */}
                <img 
                  src={project.imageUrl |

| '/placeholder-project.jpg'} 
                  alt={`Architectural preview of ${project.title}`} 
                  className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-500 ease-in-out" 
                  loading="lazy" 
                />
              </div>
              <div className="p-6 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{project.title}</h3>
                  {project.relevanceScore && (
                    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-green-100 bg-green-700 rounded-full">
                      Match
                    </span>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-6 flex-grow leading-relaxed line-clamp-4">
                  {project.description}
                </p>
                <div className="flex flex-wrap gap-2 mt-auto">
                  {project.technologies.map((tech) => (
                    <span key={`${project.id}-${tech}`} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))
        ) : (
          /* Intelligent Empty State Rendering */
         !isProcessing && debouncedQuery.length > 0 &&!errorMessage && (
            <div className="col-span-full flex flex-col items-center justify-center py-24 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
              <svg className="h-16 w-16 mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <p className="text-xl font-medium text-gray-900 dark:text-white mb-2">No conceptual intersections discovered.</p>
              <p className="text-base text-center max-w-md">
                The semantic engine could not map '{debouncedQuery}' to current portfolio architectures. Try utilizing alternative technical vocabulary or broader concepts.
              </p>
            </div>
          )
        )}
      </div>
    </section>
  );
}
