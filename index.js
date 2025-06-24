#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Date validation helper function
function validateDateString(dateString, paramName) {
  if (!dateString) {
    return null; // Optional parameter
  }
  
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    throw new Error(`${paramName} must be in ISO8601 format (YYYY-MM-DD)`);
  }
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`${paramName} is not a valid date`);
  }
  
  // Check if the date string matches the parsed date (catches invalid dates like 2024-02-30)
  const isoString = date.toISOString().split('T')[0];
  if (isoString !== dateString) {
    throw new Error(`${paramName} is not a valid date`);
  }
  
  return dateString;
}

// Simple in-memory cache for comprehensive analyses
class SearchCache {
  constructor(maxSize = 100, ttlMinutes = 30) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key, data) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }
}

// Logger utility
class Logger {
  static log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data })
    };
    
    if (level === 'error') {
      console.error(JSON.stringify(logEntry));
    } else {
      console.error(JSON.stringify(logEntry));
    }
  }

  static error(message, data) { this.log('error', message, data); }
  static warn(message, data) { this.log('warn', message, data); }
  static info(message, data) { this.log('info', message, data); }
  static debug(message, data) { this.log('debug', message, data); }
}

// Grok Search API Integration
class GrokSearchAPI {
  constructor() {
    this.baseURL = "https://api.x.ai/v1";
    this.apiKey = process.env.XAI_API_KEY;
    this.cache = new SearchCache();
    this.requestTimeout = parseInt(process.env.GROK_TIMEOUT || '30000');
    this.maxRetries = parseInt(process.env.GROK_MAX_RETRIES || '3');
    this.isHealthy = true;
    
    // Graceful handling instead of process.exit
    if (!this.apiKey) {
      this.isHealthy = false;
      Logger.error("XAI_API_KEY environment variable is required");
    }
  }

  checkHealth() {
    return {
      healthy: this.isHealthy,
      hasApiKey: !!this.apiKey,
      cacheSize: this.cache.cache.size,
      lastError: this.lastError || null
    };
  }

  async makeRequest(endpoint, data, retryCount = 0) {
    if (!this.isHealthy) {
      throw new Error("API service is not healthy - missing XAI_API_KEY");
    }

    const url = `${this.baseURL}${endpoint}`;
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`API request failed: ${response.status} - ${errorText}`);
        
        // Retry on server errors (5xx) or rate limits (429)
        if ((response.status >= 500 || response.status === 429) && retryCount < this.maxRetries) {
          const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          Logger.warn(`Request failed, retrying in ${backoffDelay}ms`, { 
            status: response.status, 
            attempt: retryCount + 1,
            maxRetries: this.maxRetries 
          });
          
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          return this.makeRequest(endpoint, data, retryCount + 1);
        }
        
        this.lastError = error.message;
        throw error;
      }

      Logger.debug(`API request successful`, { duration, endpoint });
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        const timeoutError = new Error(`Request timeout after ${this.requestTimeout}ms`);
        this.lastError = timeoutError.message;
        throw timeoutError;
      }
      
      // Retry on network errors
      if (retryCount < this.maxRetries && !error.message.includes('API request failed:')) {
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        Logger.warn(`Network error, retrying in ${backoffDelay}ms`, { 
          error: error.message, 
          attempt: retryCount + 1 
        });
        
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return this.makeRequest(endpoint, data, retryCount + 1);
      }
      
      this.lastError = error.message;
      throw new Error(`Failed to make API request: ${error.message}`);
    }
  }

  async search(query, searchType = "web", maxResults = 10, handles = null, fromDate = null, toDate = null, analysisMode = "basic") {
    // Enhanced input validation and sanitization
    if (!query || typeof query !== 'string') {
      throw new Error("Search query must be a non-empty string");
    }
    
    const sanitizedQuery = query.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    if (sanitizedQuery.length === 0) {
      throw new Error("Search query cannot be empty after sanitization");
    }
    
    if (sanitizedQuery.length > 1000) {
      throw new Error("Search query too long (max 1000 characters)");
    }

    // Check cache for comprehensive analyses
    if (analysisMode === "comprehensive") {
      const cacheKey = `${sanitizedQuery}:${searchType}:${maxResults}:${JSON.stringify(handles)}:${fromDate}:${toDate}:comprehensive`;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        Logger.debug("Cache hit for comprehensive analysis", { query: sanitizedQuery });
        return cached;
      }
    }
    // Validate date parameters
    const validatedFromDate = validateDateString(fromDate, "from_date");
    const validatedToDate = validateDateString(toDate, "to_date");
    
    // Check date logic - from_date should be before or equal to to_date
    if (validatedFromDate && validatedToDate) {
      const fromDateObj = new Date(validatedFromDate);
      const toDateObj = new Date(validatedToDate);
      if (fromDateObj > toDateObj) {
        throw new Error("from_date must be before or equal to to_date");
      }
    }
    
    // Create a search-focused system prompt
    const systemPrompt = this.getSearchSystemPrompt(searchType, analysisMode);
    
    // Build search parameters
    const searchParams = {
      mode: "on",
      return_citations: true,
      max_search_results: maxResults,
      sources: this.getSearchSources(searchType, handles)
    };
    
    // Add date filters if provided
    if (validatedFromDate) {
      searchParams.from_date = validatedFromDate;
    }
    if (validatedToDate) {
      searchParams.to_date = validatedToDate;
    }
    
    const requestData = {
      model: "grok-3-latest",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Please search for: "${sanitizedQuery}" and return the results in JSON format as specified.`
        }
      ],
      max_tokens: analysisMode === "comprehensive" ? 4000 : 2000,
      temperature: 0.1,
      stream: false,
      search_parameters: searchParams
    };

    try {
      const response = await this.makeRequest("/chat/completions", requestData);
      const results = this.parseSearchResults(response, sanitizedQuery, maxResults, analysisMode);
      
      // Cache comprehensive analyses
      if (analysisMode === "comprehensive" && results) {
        const cacheKey = `${sanitizedQuery}:${searchType}:${maxResults}:${JSON.stringify(handles)}:${fromDate}:${toDate}:comprehensive`;
        this.cache.set(cacheKey, results);
      }
      
      return results;
    } catch (error) {
      Logger.error("Search failed", { query: sanitizedQuery, error: error.message });
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  getSearchSources(searchType, handles = null) {
    switch (searchType) {
      case "web":
        return [{"type": "web"}];
      case "news":
        return [{"type": "news"}, {"type": "web"}];
      case "twitter":
      case "x":
        const xSource = {"type": "x"};
        if (handles && handles.length > 0) {
          xSource.x_handles = handles;
        }
        return [xSource];
      case "general":
      default:
        return [{"type": "web"}, {"type": "news"}, {"type": "x"}];
    }
  }

  getSearchSystemPrompt(searchType, analysisMode = "basic") {
    if (analysisMode === "comprehensive") {
      return this.getComprehensiveSystemPrompt(searchType);
    }
    
    const basePrompt = `Provide current, accurate information about the following topic using live search data. Format your response as JSON with this exact structure:
{
  "results": [
    {
      "title": "Article title or tweet content preview",
      "snippet": "Brief summary or full tweet text (max 280 characters for tweets)",
      "url": "Source URL or tweet URL",
      "source": "Source name or Twitter handle",
      "published_date": "YYYY-MM-DD",
      "author": "Author name or Twitter handle (for tweets)"
    }
  ],
  "summary": "Brief overview of findings"
}`;
    
    switch (searchType) {
      case "news":
        return basePrompt + `\n\nFocus on recent news articles and current events. Prioritize the most recent information.`;
      case "web":
        return basePrompt + `\n\nSearch across general web content including articles, blogs, and informational pages.`;
      case "twitter":
      case "x":
        return basePrompt + `\n\nSearch Twitter/X posts and tweets. Include the full tweet text in the snippet field, the author's handle, and tweet URL if available. Focus on recent posts and engagement.`;
      case "general":
      default:
        return basePrompt + `\n\nProvide comprehensive search results from various web sources including news, articles, and social media.`;
    }
  }

  getComprehensiveSystemPrompt(searchType) {
    const comprehensivePrompt = `You are a comprehensive research analyst. Provide deep, detailed analysis of the search topic using live search data. Your response must be in JSON format with this exact structure:

{
  "query": "original search query",
  "analysis_mode": "comprehensive",
  "comprehensive_analysis": "A detailed 500+ word analysis providing deep context, background, and implications. Include specific details, dates, numbers, and concrete information.",
  "key_findings": [
    {
      "category": "main_story|development|context|impact",
      "title": "Specific finding title",
      "content": "Detailed explanation with specifics, numbers, dates",
      "sources": ["url1", "url2"],
      "confidence": "high|medium|low"
    }
  ],
  "timeline": [
    {
      "date": "YYYY-MM-DD",
      "event": "Specific event description",
      "source": "Source name",
      "significance": "Why this event matters"
    }
  ],
  "direct_quotes": [
    {
      "quote": "Exact quote from source",
      "speaker": "Speaker name and title",
      "context": "When and where this was said",
      "source_url": "Source URL",
      "significance": "Why this quote is important"
    }
  ],
  "related_context": "Historical background, related events, and broader context that helps understand the topic",
  "multiple_perspectives": [
    {
      "viewpoint": "Perspective group (e.g., supporters, critics, experts)",
      "content": "What this group thinks/says about the topic",
      "sources": ["url1", "url2"],
      "reasoning": "Why this group holds this position"
    }
  ],
  "implications": {
    "short_term": "Immediate consequences and effects",
    "long_term": "Potential long-term impacts and outcomes",
    "stakeholders_affected": ["Group 1", "Group 2", "Group 3"]
  },
  "verification_status": {
    "confirmed_facts": ["Verified information with sources"],
    "unconfirmed_claims": ["Claims that need verification"],
    "contradictory_information": ["Conflicting reports or information"]
  },
  "raw_results": [
    {
      "title": "Source article title",
      "snippet": "Brief description",
      "url": "Source URL",
      "relevance_score": 1-10
    }
  ],
  "summary": "Executive summary of the entire analysis",
  "total_results": 10,
  "search_time": "ISO timestamp",
  "source": "grok-comprehensive-analysis"
}

CRITICAL INSTRUCTIONS:
1. Extract SPECIFIC details: exact dates, numbers, names, locations
2. Include DIRECT QUOTES with full attribution
3. Create a TIMELINE of events with precise dates
4. Analyze MULTIPLE PERSPECTIVES from different stakeholders
5. Provide HISTORICAL CONTEXT and background
6. Identify IMPLICATIONS and consequences
7. Verify information status and note contradictions
8. Be comprehensive but accurate - do not invent information`;

    switch (searchType) {
      case "news":
        return comprehensivePrompt + `\n\nFOCUS: Recent news events, breaking developments, and current affairs. Emphasize timeline analysis, official statements, and evolving situation updates.`;
      case "web":
        return comprehensivePrompt + `\n\nFOCUS: General web content analysis including articles, blogs, and informational sources. Emphasize factual accuracy and diverse source perspectives.`;
      case "twitter":
      case "x":
        return comprehensivePrompt + `\n\nFOCUS: Social media analysis including tweet sentiment, trending topics, and public opinion. Include influencer perspectives and viral content analysis.`;
      case "general":
      default:
        return comprehensivePrompt + `\n\nFOCUS: Comprehensive analysis across all source types - news, web content, and social media. Provide the most complete picture possible.`;
    }
  }

  parseSearchResults(response, query, maxResults, analysisMode = "basic") {
    try {
      const content = response.choices?.[0]?.message?.content || "";
      const citations = response.citations || [];
      
      // Enhanced citation processing
      const citationMetadata = this.processCitations(citations);
      
      // Enhanced JSON parsing with multiple strategies
      let parsedResults = null;
      const jsonParsingStrategies = [
        // Strategy 1: Find complete JSON object
        () => {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        },
        // Strategy 2: Find JSON between code blocks
        () => {
          const codeBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
          return codeBlockMatch ? JSON.parse(codeBlockMatch[1]) : null;
        },
        // Strategy 3: Find JSON after specific markers
        () => {
          const markerMatch = content.match(/(?:json|JSON|response):\s*(\{[\s\S]*\})/);
          return markerMatch ? JSON.parse(markerMatch[1]) : null;
        },
        // Strategy 4: Clean and try parsing the entire content
        () => {
          const cleaned = content.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
          return cleaned.startsWith('{') ? JSON.parse(cleaned) : null;
        }
      ];

      for (const strategy of jsonParsingStrategies) {
        try {
          parsedResults = strategy();
          if (parsedResults) break;
        } catch (error) {
          // Continue to next strategy
          continue;
        }
      }
      
      let results = [];
      let summary = "";
      let finalResponse = {};
      
      if (parsedResults) {
        // Check if this is a comprehensive analysis response
        if (analysisMode === "comprehensive" && parsedResults.analysis_mode === "comprehensive") {
          // Handle comprehensive analysis response
          finalResponse = {
            query: query,
            analysis_mode: "comprehensive",
            comprehensive_analysis: parsedResults.comprehensive_analysis || "",
            key_findings: parsedResults.key_findings || [],
            timeline: parsedResults.timeline || [],
            direct_quotes: parsedResults.direct_quotes || [],
            related_context: parsedResults.related_context || "",
            multiple_perspectives: parsedResults.multiple_perspectives || [],
            implications: parsedResults.implications || {},
            verification_status: parsedResults.verification_status || {},
            raw_results: parsedResults.raw_results || parsedResults.results || [],
            summary: parsedResults.summary || "",
            total_results: (parsedResults.raw_results || parsedResults.results || []).length,
            search_time: new Date().toISOString(),
            source: "grok-comprehensive-analysis",
            citations: citations,
            citation_metadata: citationMetadata
          };
        } else if (parsedResults.results) {
          // Handle basic JSON response
          results = parsedResults.results.slice(0, maxResults);
          summary = parsedResults.summary || "";
          
          // Enhanced results with better citation mapping
          results = results.map((result, index) => {
            const enhancedResult = { ...result };
            
            // Enhanced citation handling
            if (citations.length > 0) {
              // Use provided URL or map to citation
              enhancedResult.url = result.url || citations[index] || citations[0];
              
              // Add citation metadata
              const citationIndex = result.url ? 
                citations.findIndex(cite => cite === result.url) : 
                Math.min(index, citations.length - 1);
                
              if (citationIndex >= 0) {
                enhancedResult.citation_url = citations[citationIndex];
                enhancedResult.citation_index = citationIndex;
                enhancedResult.citation_metadata = citationMetadata[citationIndex] || null;
              }
            }
            
            // Ensure all required fields
            enhancedResult.source = result.source || "web-search";
            enhancedResult.published_date = result.published_date || new Date().toISOString().split('T')[0];
            
            return enhancedResult;
          });

          finalResponse = {
            query: query,
            analysis_mode: analysisMode,
            results: results,
            citations: citations,
            citation_metadata: citationMetadata,
            summary: summary,
            total_results: results.length,
            search_time: new Date().toISOString(),
            source: "grok-live-search"
          };
        } else {
          // Parsed JSON but unexpected format
          finalResponse = this.createFallbackResponse(query, content, citations, citationMetadata, analysisMode);
        }
      } else {
        // No valid JSON found - create fallback response
        finalResponse = this.createFallbackResponse(query, content, citations, citationMetadata, analysisMode);
      }
      
      return finalResponse;
    } catch (error) {
      throw new Error(`Failed to parse search results: ${error.message}`);
    }
  }

  createFallbackResponse(query, content, citations, citationMetadata, analysisMode) {
    const fallbackResults = [{
      title: `Search results for: ${query}`,
      snippet: content.substring(0, 500) + (content.length > 500 ? "..." : ""),
      url: citations[0] || null,
      source: "grok-live-search",
      published_date: new Date().toISOString().split('T')[0],
      citation_url: citations[0] || null,
      citation_index: citations.length > 0 ? 0 : null,
      citation_metadata: citationMetadata[0] || null
    }];

    if (analysisMode === "comprehensive") {
      return {
        query: query,
        analysis_mode: "comprehensive",
        comprehensive_analysis: content.length > 100 ? content : "Unable to extract comprehensive analysis from response",
        key_findings: [],
        timeline: [],
        direct_quotes: [],
        related_context: "Analysis could not be properly extracted from the response",
        multiple_perspectives: [],
        implications: {},
        verification_status: {
          confirmed_facts: [],
          unconfirmed_claims: [],
          contradictory_information: []
        },
        raw_results: fallbackResults,
        summary: "Raw search results from Grok (comprehensive analysis parsing failed)",
        total_results: 1,
        search_time: new Date().toISOString(),
        source: "grok-comprehensive-analysis-fallback",
        citations: citations,
        citation_metadata: citationMetadata
      };
    } else {
      return {
        query: query,
        analysis_mode: analysisMode,
        results: fallbackResults,
        citations: citations,
        citation_metadata: citationMetadata,
        summary: "Live search results from Grok",
        total_results: 1,
        search_time: new Date().toISOString(),
        source: "grok-live-search"
      };
    }
  }

  processCitations(citations) {
    return citations.map((citation, index) => {
      try {
        const url = new URL(citation);
        return {
          index: index,
          url: citation,
          domain: url.hostname,
          protocol: url.protocol,
          is_secure: url.protocol === 'https:',
          path: url.pathname
        };
      } catch (error) {
        return {
          index: index,
          url: citation,
          domain: null,
          protocol: null,
          is_secure: false,
          path: null,
          error: "Invalid URL format"
        };
      }
    });
  }

}

// Define the enhanced search tools with analysis mode support
const GROK_SEARCH_TOOLS = [
  {
    name: "grok_search",
    description: "Search the web using Grok's AI-powered search capabilities. Supports both basic search results and comprehensive analysis with timelines, quotes, and multiple perspectives.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to execute"
        },
        search_type: {
          type: "string",
          enum: ["web", "news", "general"],
          default: "web",
          description: "Type of search to perform"
        },
        max_results: {
          type: "number",
          default: 10,
          minimum: 1,
          maximum: 20,
          description: "Maximum number of search results to return"
        },
        analysis_mode: {
          type: "string",
          enum: ["basic", "comprehensive"],
          default: "basic",
          description: "Analysis mode: 'basic' returns simple search results, 'comprehensive' provides detailed analysis with timelines, quotes, multiple perspectives, and context"
        },
        from_date: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "Optional start date for search in ISO8601 format (YYYY-MM-DD). Limits search to content from this date onwards."
        },
        to_date: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "Optional end date for search in ISO8601 format (YYYY-MM-DD). Limits search to content up to this date."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "grok_web_search",
    description: "Search general web content using Grok. Supports comprehensive analysis mode for detailed insights.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The web search query"
        },
        analysis_mode: {
          type: "string",
          enum: ["basic", "comprehensive"],
          default: "basic",
          description: "Analysis mode: 'basic' returns simple search results, 'comprehensive' provides detailed analysis with timelines, quotes, multiple perspectives, and context"
        },
        max_results: {
          type: "number",
          default: 10,
          minimum: 1,
          maximum: 20,
          description: "Maximum number of results to return"
        },
        from_date: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "Optional start date for search in ISO8601 format (YYYY-MM-DD). Limits search to content from this date onwards."
        },
        to_date: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "Optional end date for search in ISO8601 format (YYYY-MM-DD). Limits search to content up to this date."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "grok_news_search",
    description: "Search for recent news using Grok. Comprehensive mode provides timeline analysis, direct quotes, and multiple perspectives on news events.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The news search query"
        },
        analysis_mode: {
          type: "string",
          enum: ["basic", "comprehensive"],
          default: "basic",
          description: "Analysis mode: 'basic' returns simple search results, 'comprehensive' provides detailed analysis with timelines, quotes, multiple perspectives, and context"
        },
        max_results: {
          type: "number",
          default: 10,
          minimum: 1,
          maximum: 20,
          description: "Maximum number of news results to return"
        },
        from_date: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "Optional start date for search in ISO8601 format (YYYY-MM-DD). Limits search to content from this date onwards."
        },
        to_date: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "Optional end date for search in ISO8601 format (YYYY-MM-DD). Limits search to content up to this date."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "grok_twitter",
    description: "Search Twitter/X posts using Grok's X search capabilities, optionally filtered by specific handles. Comprehensive mode analyzes social media trends and sentiment.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to find tweets/posts about"
        },
        handles: {
          type: "array",
          items: {
            type: "string"
          },
          description: "Optional list of Twitter handles to search from (without @ symbol, e.g., ['elonmusk', 'twitter'])"
        },
        analysis_mode: {
          type: "string",
          enum: ["basic", "comprehensive"],
          default: "basic",
          description: "Analysis mode: 'basic' returns simple search results, 'comprehensive' provides detailed analysis with timelines, quotes, multiple perspectives, and context"
        },
        max_results: {
          type: "number",
          default: 10,
          minimum: 1,
          maximum: 20,
          description: "Maximum number of tweet results to return"
        },
        from_date: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "Optional start date for search in ISO8601 format (YYYY-MM-DD). Limits search to content from this date onwards."
        },
        to_date: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "Optional end date for search in ISO8601 format (YYYY-MM-DD). Limits search to content up to this date."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "health_check",
    description: "Check the health status of the Grok Search MCP server and API connectivity",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  }
];

// Main server class
class GrokSearchServer {
  constructor() {
    try {
      this.grokAPI = new GrokSearchAPI();
      this.startTime = Date.now();
      this.requestCount = 0;
      this.errorCount = 0;
    } catch (error) {
      console.error("Failed to initialize Grok API:", error.message);
      process.exit(1);
    }
  }

  async handleSearch(toolName, args) {
    this.requestCount++;
    try {
      const { 
        query, 
        max_results = 10, 
        search_type = "web", 
        analysis_mode = "basic",
        handles, 
        from_date, 
        to_date 
      } = args;
      
      if (!query || query.trim().length === 0) {
        throw new Error("Search query is required and cannot be empty");
      }

      // Determine search type based on tool name
      let actualSearchType = search_type;
      let searchHandles = handles;
      
      if (toolName === "grok_web_search") {
        actualSearchType = "web";
      } else if (toolName === "grok_news_search") {
        actualSearchType = "news";
      } else if (toolName === "grok_twitter") {
        actualSearchType = "twitter";
        searchHandles = handles;
      }

      // Call search with date parameters and analysis mode
      const results = await this.grokAPI.search(
        query.trim(), 
        actualSearchType, 
        max_results, 
        searchHandles, 
        from_date, 
        to_date,
        analysis_mode
      );
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(results, null, 2)
        }]
      };

    } catch (error) {
      this.errorCount++;
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: error.message,
            status: 'failed',
            query: args.query || "unknown",
            search_type: args.search_type || "web",
            analysis_mode: args.analysis_mode || "basic",
            from_date: args.from_date || null,
            to_date: args.to_date || null,
            timestamp: new Date().toISOString(),
            request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          }, null, 2)
        }],
        isError: true
      };
    }
  }

  async handleHealthCheck() {
    try {
      const apiHealth = this.grokAPI.checkHealth();
      const uptime = Date.now() - this.startTime;
      const successRate = this.requestCount > 0 ? 
        (((this.requestCount - this.errorCount) / this.requestCount) * 100).toFixed(2) + "%" : 
        "N/A";

      const healthStatus = {
        server_healthy: true,
        api_healthy: apiHealth.healthy,
        uptime_ms: uptime,
        total_requests: this.requestCount,
        error_count: this.errorCount,
        success_rate: successRate,
        api_details: {
          hasApiKey: apiHealth.hasApiKey,
          cacheSize: apiHealth.cacheSize,
          lastError: apiHealth.lastError
        }
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(healthStatus, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            server_healthy: false,
            error: error.message,
            timestamp: new Date().toISOString()
          }, null, 2)
        }],
        isError: true
      };
    }
  }
}

// Create and configure server
const server = new Server(
  {
    name: "grok-search-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const grokSearchServer = new GrokSearchServer();

// Set up request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: GROK_SEARCH_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (["grok_search", "grok_web_search", "grok_news_search", "grok_twitter"].includes(name)) {
    return await grokSearchServer.handleSearch(name, args || {});
  }
  
  if (name === "health_check") {
    return await grokSearchServer.handleHealthCheck();
  }

  return {
    content: [{
      type: "text",
      text: `Unknown tool: ${name}`
    }],
    isError: true
  };
});

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Grok Search MCP Server v1.0.0

USAGE:
  grok-search-mcp [options]

OPTIONS:
  --help, -h    Show this help message

DESCRIPTION:
  MCP server providing comprehensive web search capabilities using xAI's Grok API.
  Supports basic search results and comprehensive analysis with timelines, quotes,
  and multiple perspectives.

ENVIRONMENT VARIABLES:
  XAI_API_KEY          Required: Your xAI API key from https://console.x.ai/
  GROK_TIMEOUT         Optional: Request timeout in ms (default: 30000)
  GROK_MAX_RETRIES     Optional: Max retry attempts (default: 3)

TOOLS PROVIDED:
  - grok_search        General search with configurable types
  - grok_web_search    Web content search
  - grok_news_search   News and current events
  - grok_twitter       Twitter/X posts search
  - health_check       Server health diagnostics

For setup instructions, visit: https://github.com/stat-guy/grok-search-mcp

© 2025 Enhanced Grok Search MCP Server
`);
  process.exit(0);
}

// Run the server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Grok Search MCP Server running on stdio");
}

runServer().catch((error) => {
  Logger.error("Fatal error running server", { error: error.message });
  process.exit(1);
});