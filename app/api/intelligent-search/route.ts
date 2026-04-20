// @/app/api/intelligent-search/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Configure the route to run on the Edge runtime for minimum latency and global distribution
export const runtime = 'edge';

// Simulation of a highly structured, AI-readable vector knowledge base
const ARCHITECTURAL_KNOWLEDGE_BASE =,
    imageUrl: '/assets/projects/hft-dashboard.jpg',
    liveUrl: 'https://demo.trading-dashboard.com',
    semanticTags: 'finance, real-time, high speed, performance optimization, data visualization, trading, charting, low latency, fintech',
  },
  {
    id: 'arch_beta',
    title: 'E-Commerce Machine Learning Recommendation Engine',
    description: 'An intelligent product recommendation system that analyzes user session behavior, temporal patterns, and purchase history to dynamically predict and display highly relevant items. Integrates directly with existing Next.js storefronts via GraphQL.',
    technologies:,
    imageUrl: '/assets/projects/ecommerce-ai.jpg',
    liveUrl: 'https://ecommerce-engine.dev',
    semanticTags: 'shop, retail, predictive algorithms, machine learning, artificial intelligence, ai, ecommerce, suggestions, neural network, shopping cart',
  },
  {
    id: 'arch_gamma',
    title: 'Decentralized Zero-Knowledge Identity Protocol',
    description: 'A blockchain-based protocol enabling users to securely verify their identity across multiple decentralized applications without exposing underlying personal identifiable information (PII). Implements advanced zero-knowledge proof cryptography.',
    technologies:,
    imageUrl: '/assets/projects/zk-identity.jpg',
    semanticTags: 'web3, blockchain, crypto, security, identity verification, smart contracts, zero knowledge, privacy, dapps, decentralized',
  },
  {
    id: 'arch_delta',
    title: 'Global Supply Chain Logistics Tracker',
    description: 'A comprehensive logistics management interface tracking shipping containers globally. Utilizes websockets for live geolocation updates and a highly scalable microservices architecture on AWS.',
    technologies:,
    imageUrl: '/assets/projects/logistics.jpg',
    semanticTags: 'logistics, shipping, tracking, maps, geolocation, real-time, global, supply chain, enterprise, dashboard',
  }
];

/**
 * Advanced Semantic Scoring Algorithm
 * Simulates vector embedding proximity by analyzing term frequency, 
 * conceptual overlap, and exact technological keyword matches.
 */
function calculateSemanticProximity(query: string, project: typeof ARCHITECTURAL_KNOWLEDGE_BASE): number {
  // Normalize the input query for consistent comparison
  const normalizedQuery = query.toLowerCase().trim().replace(/[^\w\s]/gi, '');
  if (!normalizedQuery) return 0;

  // Utilize n-gram tokenization strategy
  const queryTokens = normalizedQuery.split(/\s+/);
  
  let proximityScore = 0;
  
  // Aggregate all searchable text domains into a single unified context string
  const contextCorpus = `${project.title} ${project.description} ${project.technologies.join(' ')} ${project.semanticTags}`.toLowerCase();
  
  queryTokens.forEach(token => {
    // Ignore common stop words to improve signal-to-noise ratio
    if (['a', 'an', 'the', 'in', 'on', 'for', 'to', 'of', 'and', 'with'].includes(token)) return;

    // Highest Weighting (10.0): Exact technological stack matches
    const techMatch = project.technologies.some(t => t.toLowerCase() === token |

| t.toLowerCase().includes(token));
    if (techMatch) proximityScore += 10.0;

    // High Weighting (6.0): Direct matches within predefined semantic conceptual tags
    if (project.semanticTags.includes(token)) proximityScore += 6.0;

    // Medium Weighting (3.0 per match): Regex-based contextual matching within the title and description corpus
    const contextualRegex = new RegExp(`\\b${token}\\b`, 'gi');
    const corpusMatches = contextCorpus.match(contextualRegex);
    if (corpusMatches) {
      proximityScore += (corpusMatches.length * 3.0);
    }
    
    // Partial Matching (1.0): Accommodates slight misspellings or root word variations (e.g., 'block' matching 'blockchain')
    if (token.length > 3 && contextCorpus.includes(token)) {
      proximityScore += 1.0;
    }
  });

  return proximityScore;
}

export async function POST(request: NextRequest) {
  try {
    // Parse the incoming JSON payload safely
    const body = await request.json();
    const { prompt } = body;

    // Input validation matrix
    if (prompt === undefined |

| prompt === null) {
      return NextResponse.json({ error: 'Payload missing required "prompt" parameter.' }, { status: 400 });
    }

    if (typeof prompt!== 'string' |

| prompt.trim() === '') {
       // Return empty results gracefully for empty string queries to prevent UI errors
       return NextResponse.json({ results: }, { status: 200 });
    }

    // Execute the semantic proximity algorithm across the entire knowledge base
    const scoredArchitectures = ARCHITECTURAL_KNOWLEDGE_BASE.map(project => {
      const relevanceScore = calculateSemanticProximity(prompt, project);
      return {...project, relevanceScore };
    });

    // Filter out irrelevant projects (score must exceed a baseline threshold of 2.0)
    // Sort the results in descending order based on the calculated relevance score
    const intelligentResults = scoredArchitectures
     .filter(project => project.relevanceScore > 2.0)
     .sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Return the successfully serialized array of structured portfolio objects
    return NextResponse.json({ results: intelligentResults }, { status: 200 });

  } catch (error) {
    // Comprehensive diagnostic logging for server-side monitoring tools (e.g., Sentry, Datadog)
    console.error(' Critical failure in Route Execution:', error);
    
    // Returning a structured 500 error ensures the client component can read the error payload
    // and display a graceful fallback UI, entirely preventing the "unresponsive interface" bug.
    return NextResponse.json(
      { error: 'An internal anomaly occurred during the semantic analysis phase. The architectural mapping failed.' }, 
      { status: 500 }
    );
  }
}
