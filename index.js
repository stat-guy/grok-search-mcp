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

  getSearchSystemPrompt(searchType) {
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

  parseSearchResults(response, query, maxResults) {
    try {
      const content = response.choices?.[0]?.message?.content || "";
      const citations = response.citations || [];
      
      // Enhanced citation processing
      const citationMetadata = this.processCitations(citations);
      
      // Try to parse JSON from Grok's response
      let parsedResults = null;
      try {
        // Look for JSON in the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResults = JSON.parse(jsonMatch[0]);
        }
      } catch (jsonError) {
        console.error("JSON parsing failed:", jsonError.message);
      }
      
      let results = [];
      let summary = "";
      
      if (parsedResults && parsedResults.results) {
        // Successfully parsed JSON response
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
      } else {
        // Fallback: create a single result with the full response
        results = [{
          title: `Search results for: ${query}`,
          snippet: content.substring(0, 500) + (content.length > 500 ? "..." : ""),
          url: citations[0] || null,
          source: "grok-live-search",
          published_date: new Date().toISOString().split('T')[0],
          citation_url: citations[0] || null,
          citation_index: citations.length > 0 ? 0 : null,
          citation_metadata: citationMetadata[0] || null
        }];
        summary = "Live search results from Grok";
      }
      
      return {
        query: query,
        results: results,
        citations: citations,
        citation_metadata: citationMetadata,
        summary: summary,
        total_results: results.length,
        search_time: new Date().toISOString(),
        source: "grok-live-search"
      };
    } catch (error) {
      throw new Error(`Failed to parse search results: ${error.message}`);
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
    } catch (error) {
      console.error("Failed to initialize Grok API:", error.message);
      process.exit(1);
    }
  }

  async handleSearch(toolName, args) {
    try {
      const { 
        query, 
        max_results = 10, 
        search_type = "web", 
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

      // Call search with date parameters
      const results = await this.grokAPI.search(
        query.trim(), 
        actualSearchType, 
        max_results, 
        searchHandles, 
        from_date, 
        to_date
      );
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(results, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: error.message,
            status: 'failed',
            query: args.query || "unknown",
            from_date: args.from_date || null,
            to_date: args.to_date || null
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