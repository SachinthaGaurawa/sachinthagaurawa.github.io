// env.d.ts
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';

namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SITE_URL: string;
    // Explicitly define any external API keys here if migrating to a true LLM backend
    OPENAI_API_KEY?: string; 
    NODE_ENV: 'development' | 'production' | 'test';
  }
}
