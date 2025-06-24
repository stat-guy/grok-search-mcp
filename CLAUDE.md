# Grok Search MCP Server - AI Assistant Implementation Guide

## Overview for AI Assistants

This document provides comprehensive technical guidance for AI assistants to help users download, install, configure, and implement the Grok Search MCP server. The server enables sophisticated web search capabilities with both basic results and comprehensive analysis modes through xAI's Grok API.

## Quick Reference

### Installation Command
```bash
git clone https://github.com/stat-guy/grok-search-mcp.git
cd grok-search-mcp
npm install -g .
```

### Claude Desktop Configuration
```json
{
  "mcpServers": {
    "grok-search": {
      "command": "npx",
      "args": ["grok-search-mcp"],
      "env": {
        "XAI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Configuration File Locations
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

## Installation Instructions for Users

### Step 1: Obtain xAI API Key

Guide users through these steps:

1. Visit the [xAI Developer Portal](https://console.x.ai/)
2. Create an account or sign in
3. Navigate to API Keys section
4. Generate a new API key
5. Copy the API key (format: `xai-...`)

### Step 2: Installation (Recommended)

Direct users through the 3-step process:
```bash
git clone https://github.com/stat-guy/grok-search-mcp.git
cd grok-search-mcp
npm install -g .
```

This automatically:
- Downloads the latest version
- Installs dependencies globally
- Makes the command available system-wide

### Step 3: Verify Installation

Guide users to test the installation:
```bash
npx grok-search-mcp --help
```

**Success indicator:** If you see "Grok Search MCP Server v1.0.0" help text, installation is ready!

### Alternative: NPX Usage

For quick testing without installation:
```bash
npx grok-search-mcp
```

### Step 4: Configure Claude Desktop

Help users locate and edit their Claude Desktop configuration:

#### macOS Configuration
```bash
# Open the file in an editor
open -e ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

#### Windows Configuration
```cmd
# Open the file in notepad
notepad %APPDATA%\Claude\claude_desktop_config.json
```

#### Configuration Template
```json
{
  "mcpServers": {
    "grok-search": {
      "command": "npx",
      "args": ["grok-search-mcp"],
      "env": {
        "XAI_API_KEY": "xai-your-actual-api-key-here",
        "GROK_TIMEOUT": "30000",
        "GROK_MAX_RETRIES": "3"
      }
    }
  }
}
```

### Step 5: Restart Claude Desktop

After configuration changes, users must:
1. Completely quit Claude Desktop
2. Restart the application
3. Verify the server appears in available tools

## Technical Specifications

### System Requirements
- **Node.js**: Version 18.0.0 or higher
- **Operating System**: macOS, Windows, Linux
- **Memory**: Minimum 512MB available RAM
- **Network**: Internet connection for API calls

### Server Architecture
- **Protocol**: Model Context Protocol (MCP) 1.0
- **Transport**: stdio (standard input/output)
- **Format**: JSON-RPC 2.0
- **Language**: JavaScript (ES modules)

## Available Tools and Parameters

### 1. `grok_search` - Universal Search Tool

**Purpose**: General-purpose search with configurable types and analysis modes

**Parameters**:
```typescript
{
  query: string;           // Required: Search query (1-1000 characters)
  search_type?: "web" | "news" | "general";  // Default: "web"
  analysis_mode?: "basic" | "comprehensive"; // Default: "basic"
  max_results?: number;    // 1-20, Default: 10
  from_date?: string;      // ISO8601 format: YYYY-MM-DD
  to_date?: string;        // ISO8601 format: YYYY-MM-DD
}
```

**Parameter Validation**:
- `query`: Must be non-empty string, max 1000 characters
- `search_type`: Must be one of the enumerated values
- `analysis_mode`: Must be "basic" or "comprehensive"
- `max_results`: Integer between 1 and 20 inclusive
- `from_date`/`to_date`: Must match regex `^\d{4}-\d{2}-\d{2}$` and be valid dates

### 2. `grok_web_search` - Web Content Search

**Purpose**: Search general web content with comprehensive analysis support

**Parameters**:
```typescript
{
  query: string;           // Required: Web search query
  max_results?: number;    // 1-20, Default: 10
  from_date?: string;      // ISO8601 format: YYYY-MM-DD
  to_date?: string;        // ISO8601 format: YYYY-MM-DD
}
```

### 3. `grok_news_search` - News and Current Events

**Purpose**: Search recent news with timeline analysis and comprehensive context

**Parameters**:
```typescript
{
  query: string;           // Required: News search query
  max_results?: number;    // 1-20, Default: 10
  from_date?: string;      // ISO8601 format: YYYY-MM-DD
  to_date?: string;        // ISO8601 format: YYYY-MM-DD
}
```

### 4. `grok_twitter` - Social Media Search

**Purpose**: Search Twitter/X posts with sentiment analysis and social media insights

**Parameters**:
```typescript
{
  query: string;           // Required: Twitter search query
  handles?: string[];      // Optional: Twitter handles without @ symbol
  max_results?: number;    // 1-20, Default: 10
  from_date?: string;      // ISO8601 format: YYYY-MM-DD
  to_date?: string;        // ISO8601 format: YYYY-MM-DD
}
```

**Handle Format**: 
- Correct: `["elonmusk", "OpenAI", "AnthropicAI"]`
- Incorrect: `["@elonmusk", "@OpenAI"]` (no @ symbol)

### 5. `health_check` - Server Diagnostics

**Purpose**: Monitor server health and API connectivity

**Parameters**: None required

**Response Format**:
```typescript
{
  server_healthy: boolean;
  api_healthy: boolean;
  uptime_ms: number;
  total_requests: number;
  error_count: number;
  success_rate: string;
  api_details: {
    hasApiKey: boolean;
    cacheSize: number;
    lastError?: string;
  }
}
```

## Response Format Specifications

### Basic Mode Response Structure

```typescript
interface BasicResponse {
  query: string;
  analysis_mode: "basic";
  results: SearchResult[];
  citations: string[];
  citation_metadata: CitationMetadata[];
  summary: string;
  total_results: number;
  search_time: string;        // ISO8601 timestamp
  source: "grok-live-search";
}

interface SearchResult {
  title: string;
  snippet: string;            // Max 500 characters
  url: string;
  source: string;
  published_date: string;     // YYYY-MM-DD format
  author?: string;
  citation_url?: string;
  citation_index?: number;
  citation_metadata?: CitationMetadata;
}

interface CitationMetadata {
  index: number;
  url: string;
  domain: string;
  protocol: string;
  is_secure: boolean;
  path: string;
  error?: string;             // If URL parsing failed
}
```

### Comprehensive Mode Response Structure

```typescript
interface ComprehensiveResponse extends BasicResponse {
  analysis_mode: "comprehensive";
  comprehensive_analysis: string;    // Detailed analysis 500+ words
  key_findings: KeyFinding[];
  timeline: TimelineEvent[];
  direct_quotes: Quote[];
  related_context: string;
  multiple_perspectives: Perspective[];
  implications: {
    short_term: string;
    long_term: string;
    stakeholders_affected: string[];
  };
  verification_status: {
    confirmed_facts: string[];
    unconfirmed_claims: string[];
    contradictory_information: string[];
  };
  raw_results: RawResult[];
  source: "grok-comprehensive-analysis";
}

interface KeyFinding {
  category: "main_story" | "development" | "context" | "impact";
  title: string;
  content: string;
  sources: string[];
  confidence: "high" | "medium" | "low";
}

interface TimelineEvent {
  date: string;              // YYYY-MM-DD format
  event: string;
  source: string;
  significance: string;
}

interface Quote {
  quote: string;
  speaker: string;
  context: string;
  source_url: string;
  significance: string;
}

interface Perspective {
  viewpoint: string;
  content: string;
  sources: string[];
  reasoning: string;
}

interface RawResult {
  title: string;
  snippet: string;
  url: string;
  relevance_score: number;   // 1-10 scale
}
```

## Error Handling and Response Parsing

### Standard Error Response Format

```typescript
interface ErrorResponse {
  error: string;
  status: "failed";
  query?: string;
  search_type?: string;
  analysis_mode?: string;
  timestamp: string;         // ISO8601 timestamp
  request_id: string;        // Format: req_{timestamp}_{random}
  from_date?: string | null;
  to_date?: string | null;
}
```

### Common Error Types and Handling

#### 1. API Key Issues
```typescript
// Error: "API service is not healthy - missing XAI_API_KEY"
// Resolution: Guide user to set XAI_API_KEY environment variable
```

#### 2. Input Validation Errors
```typescript
// Error: "Search query must be a non-empty string"
// Error: "Search query too long (max 1000 characters)"
// Error: "from_date must be in ISO8601 format (YYYY-MM-DD)"
// Resolution: Validate input before making requests
```

#### 3. API Rate Limiting
```typescript
// Error: "API request failed: 429 - Rate limit exceeded"
// Resolution: Server automatically retries with exponential backoff
```

#### 4. Network and Timeout Issues
```typescript
// Error: "Request timeout after 30000ms"
// Error: "Failed to make API request: Network error"
// Resolution: Server automatically retries up to 3 times
```

### Response Parsing Best Practices

#### Parsing JSON Responses
```javascript
function parseSearchResponse(responseText) {
  try {
    const response = JSON.parse(responseText);
    
    // Check for error responses
    if (response.error || response.status === "failed") {
      return {
        success: false,
        error: response.error || "Unknown error",
        errorDetails: response
      };
    }
    
    // Validate required fields
    if (!response.query || !response.results) {
      throw new Error("Invalid response format");
    }
    
    return {
      success: true,
      data: response
    };
  } catch (error) {
    return {
      success: false,
      error: `JSON parsing failed: ${error.message}`,
      rawResponse: responseText
    };
  }
}
```

#### Handling Different Analysis Modes
```javascript
function processSearchResults(response) {
  if (response.analysis_mode === "comprehensive") {
    // Handle comprehensive response
    return {
      type: "comprehensive",
      analysis: response.comprehensive_analysis,
      keyFindings: response.key_findings || [],
      timeline: response.timeline || [],
      quotes: response.direct_quotes || [],
      perspectives: response.multiple_perspectives || [],
      basicResults: response.raw_results || response.results
    };
  } else {
    // Handle basic response
    return {
      type: "basic",
      results: response.results || [],
      summary: response.summary || "",
      citations: response.citations || []
    };
  }
}
```

## Configuration Management

### Environment Variables

```typescript
interface EnvironmentConfig {
  XAI_API_KEY: string;        // Required: xAI API key
  GROK_TIMEOUT?: string;      // Optional: Request timeout in ms (default: 30000)
  GROK_MAX_RETRIES?: string;  // Optional: Max retry attempts (default: 3)
}
```

### Claude Desktop Configuration Options

#### Basic Configuration
```json
{
  "mcpServers": {
    "grok-search": {
      "command": "npx",
      "args": ["grok-search-mcp"],
      "env": {
        "XAI_API_KEY": "your-api-key"
      }
    }
  }
}
```

#### Advanced Configuration
```json
{
  "mcpServers": {
    "grok-search": {
      "command": "npx",
      "args": ["grok-search-mcp"],
      "env": {
        "XAI_API_KEY": "your-api-key",
        "GROK_TIMEOUT": "45000",
        "GROK_MAX_RETRIES": "5"
      }
    }
  }
}
```

#### Development Configuration
```json
{
  "mcpServers": {
    "grok-search-dev": {
      "command": "node",
      "args": ["/path/to/grok-search-mcp/index.js"],
      "cwd": "/path/to/grok-search-mcp",
      "env": {
        "XAI_API_KEY": "your-api-key",
        "NODE_ENV": "development"
      }
    }
  }
}
```

## Integration Patterns for AI Assistants

### 1. Basic Search Implementation

```javascript
// Guide users to make basic searches
const basicSearchExample = {
  tool: "grok_search",
  parameters: {
    query: "latest AI developments",
    search_type: "news",
    max_results: 5,
    analysis_mode: "basic"
  }
};

// Expected response parsing
function handleBasicSearch(response) {
  if (response.results && response.results.length > 0) {
    return response.results.map(result => ({
      title: result.title,
      summary: result.snippet,
      url: result.url,
      source: result.source,
      date: result.published_date
    }));
  }
  return [];
}
```

### 2. Comprehensive Analysis Implementation

```javascript
// Guide users to request detailed analysis
const comprehensiveAnalysisExample = {
  tool: "grok_news_search",
  parameters: {
    query: "climate change policy 2025",
    analysis_mode: "comprehensive",
    max_results: 10,
    from_date: "2025-01-01"
  }
};

// Expected response processing
function handleComprehensiveAnalysis(response) {
  return {
    mainAnalysis: response.comprehensive_analysis,
    keyPoints: response.key_findings?.map(f => f.title) || [],
    timeline: response.timeline?.map(t => `${t.date}: ${t.event}`) || [],
    quotes: response.direct_quotes?.map(q => `"${q.quote}" - ${q.speaker}`) || [],
    perspectives: response.multiple_perspectives?.map(p => p.viewpoint) || [],
    implications: response.implications || {},
    sources: response.citations || []
  };
}
```

### 3. Error Handling Pattern

```javascript
// Robust error handling for AI assistants
function handleSearchError(response) {
  if (response.error) {
    const errorType = categorizeError(response.error);
    
    switch (errorType) {
      case 'API_KEY':
        return "Please check that your XAI_API_KEY is correctly set in the configuration.";
      case 'RATE_LIMIT':
        return "API rate limit reached. The server will automatically retry. Please wait a moment.";
      case 'TIMEOUT':
        return "Request timed out. Try again or use basic mode for faster responses.";
      case 'VALIDATION':
        return `Input validation error: ${response.error}`;
      default:
        return `Search failed: ${response.error}`;
    }
  }
  return "Unknown error occurred.";
}

function categorizeError(errorMessage) {
  if (errorMessage.includes('API key')) return 'API_KEY';
  if (errorMessage.includes('rate limit')) return 'RATE_LIMIT';
  if (errorMessage.includes('timeout')) return 'TIMEOUT';
  if (errorMessage.includes('validation') || errorMessage.includes('format')) return 'VALIDATION';
  return 'UNKNOWN';
}
```

### 4. Health Check Implementation

```javascript
// Monitor server health
const healthCheckExample = {
  tool: "health_check",
  parameters: {}
};

function interpretHealthCheck(response) {
  const health = JSON.parse(response.content[0].text);
  
  if (!health.server_healthy) {
    return "Server is not healthy. Check logs for details.";
  }
  
  if (!health.api_healthy || !health.api_details.hasApiKey) {
    return "API configuration issue. Verify XAI_API_KEY is set correctly.";
  }
  
  return `Server is healthy. Success rate: ${health.success_rate}, Total requests: ${health.total_requests}`;
}
```

## Performance Optimization

### Caching Strategy

The server implements intelligent caching for comprehensive analyses:

- **Cache Duration**: 30 minutes TTL
- **Cache Size**: Maximum 100 items (LRU eviction)
- **Cache Keys**: Include all parameters for accuracy
- **Cache Scope**: Only comprehensive analyses (expensive operations)

**AI Assistant Guidance**:
- Inform users that comprehensive analyses are cached
- Suggest rerunning queries after 30 minutes for updated information
- Recommend basic mode for always-fresh results

### Token Management

**Analysis Mode Token Usage**:
- **Basic Mode**: ~2000 tokens maximum
- **Comprehensive Mode**: ~4000 tokens maximum

**Cost Optimization Tips**:
1. Use basic mode for simple queries
2. Reserve comprehensive mode for complex analysis needs
3. Cache results are automatically used when available
4. Consider date ranges to limit scope

### Request Optimization

**Best Practices for AI Assistants**:

1. **Query Optimization**:
   - Suggest clear, specific queries
   - Recommend date ranges for time-sensitive topics
   - Guide users to use appropriate search types

2. **Parameter Selection**:
   - Default to basic mode unless comprehensive analysis is needed
   - Use appropriate max_results (5-10 for most cases)
   - Suggest specific handles for Twitter searches

3. **Error Prevention**:
   - Validate input before requests
   - Handle edge cases gracefully
   - Provide clear error messages

## Troubleshooting Guide for AI Assistants

### Common User Issues

#### 1. Server Not Appearing in Claude Desktop

**Diagnosis Steps**:
1. Check if Claude Desktop was restarted after configuration
2. Verify configuration file location and syntax
3. Check for JSON syntax errors
4. Validate environment variable names

**Resolution Commands**:
```bash
# Validate JSON configuration
python -m json.tool ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Test NPX installation
npx grok-search-mcp --version

# Check Node.js version
node --version
```

#### 2. API Key Configuration Issues

**Common Error Signs**:
- "API service is not healthy"
- "missing XAI_API_KEY" 
- Tools execute but return API errors

**Resolution Steps**:
1. Verify API key format (starts with "xai-")
2. Check environment variable spelling
3. Ensure no extra spaces or quotes
4. Test with health_check tool

#### 3. Search Results Quality Issues

**For Poor Results**:
- Try different query phrasings
- Use date ranges to narrow scope
- Switch between basic and comprehensive modes
- Try different search types (web vs news vs twitter)

**For No Results**:
- Check query spelling and formatting
- Verify topic has sufficient online coverage
- Try broader or more specific queries
- Check if topic is too recent or too old

#### 4. Performance Issues

**Slow Responses**:
- Check network connectivity
- Try basic mode instead of comprehensive
- Reduce max_results parameter
- Check server health with health_check tool

**Timeout Errors**:
- Increase GROK_TIMEOUT environment variable
- Use basic mode for faster responses
- Check if API service is experiencing issues

### Diagnostic Commands

```bash
# Test server startup
XAI_API_KEY=your-key npx grok-search-mcp

# Run test suite
cd grok-search-mcp && npm test

# Monitor server logs
npx grok-search-mcp 2>debug.log &

# Check configuration
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq
```

## Security Best Practices

### API Key Management

**For AI Assistants to Communicate**:

1. **Never log or display API keys**
2. **Store in environment variables only**
3. **Use configuration files, not command line arguments**
4. **Rotate keys regularly**
5. **Monitor usage through xAI Developer Portal**

### Input Sanitization

The server automatically:
- Removes control characters from queries
- Validates input lengths and formats
- Sanitizes date parameters
- Prevents injection attacks

### Network Security

- All API communications use HTTPS
- Request timeouts prevent hanging connections
- Retry logic includes backoff to prevent abuse
- No sensitive data is cached

## Advanced Features

### Custom Search Sources

The server supports different search source configurations:

```typescript
interface SearchSources {
  web: { type: "web" };
  news: { type: "news" } | { type: "web" };
  twitter: { type: "x", x_handles?: string[] };
  general: { type: "web" } | { type: "news" } | { type: "x" };
}
```

### Date Range Filtering

Supports precise date filtering:
- **Format**: ISO8601 (YYYY-MM-DD)
- **Validation**: Automatic date validation and range checking
- **Logic**: from_date must be <= to_date
- **Scope**: Applies to content publication dates

### Citation Processing

Enhanced citation handling includes:
- **URL Validation**: Automatic URL parsing and validation
- **Metadata Extraction**: Domain, protocol, security status
- **Index Mapping**: Results mapped to citation sources
- **Error Handling**: Graceful handling of invalid URLs

## MCP Protocol Implementation Details

### Protocol Compliance

The server implements MCP 1.0 specification:
- **Transport**: stdio with JSON-RPC 2.0
- **Methods**: tools/list, tools/call
- **Capabilities**: tools
- **Error Handling**: Standard MCP error responses

### Message Format

#### Tool List Request
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

#### Tool Call Request
```json
{
  "jsonrpc": "2.0", 
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "grok_search",
    "arguments": {
      "query": "search query",
      "analysis_mode": "comprehensive"
    }
  }
}
```

#### Response Format
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"query\":\"search query\",\"results\":[...]}"
      }
    ],
    "isError": false
  }
}
```

## Testing and Validation

### Automated Testing

The server includes a comprehensive test suite:

```bash
# Run all tests
npm test

# Test with API key
XAI_API_KEY=your-key npm test
```

**Test Coverage**:
- Tool list functionality
- Basic and comprehensive search modes
- Error handling and validation
- Health check functionality
- Date range filtering
- Citation processing
- Input sanitization

### Manual Testing

**Basic Functionality Test**:
```json
{
  "tool": "grok_search",
  "parameters": {
    "query": "test query",
    "analysis_mode": "basic",
    "max_results": 3
  }
}
```

**Comprehensive Analysis Test**:
```json
{
  "tool": "grok_news_search", 
  "parameters": {
    "query": "recent developments",
    "analysis_mode": "comprehensive",
    "from_date": "2025-06-01"
  }
}
```

**Health Check Test**:
```json
{
  "tool": "health_check",
  "parameters": {}
}
```

## Version Information and Updates

### Current Version: 2.0.0 (Enhanced)

**Major Features**:
- Comprehensive analysis mode with rich context
- Enhanced error handling with retry logic
- Intelligent caching system
- Health monitoring and diagnostics
- Structured logging and performance metrics
- Advanced input validation and sanitization

### Compatibility

- **MCP Protocol**: 1.0+
- **Claude Desktop**: All versions supporting MCP
- **Node.js**: 18.0.0+
- **NPM**: 6.0.0+

### Update Instructions

```bash
# Update via NPX (automatic)
npx grok-search-mcp@latest

# Update local installation
cd grok-search-mcp
git pull origin main
npm install
```

## Support and Resources

### For AI Assistants

When helping users:

1. **Always verify Node.js version first**
2. **Guide through API key setup carefully**
3. **Test with health_check after configuration**
4. **Provide specific error explanations**
5. **Suggest appropriate analysis modes**
6. **Monitor performance and suggest optimizations**

### Common Success Patterns

1. **Start with basic mode** to verify functionality
2. **Use health_check** to diagnose issues
3. **Test with simple queries** before complex analysis
4. **Verify API key** before troubleshooting other issues
5. **Use appropriate search types** for the content needed

### Resource Links

- **xAI Developer Portal**: https://console.x.ai/
- **MCP Specification**: https://modelcontextprotocol.io/
- **Claude Desktop**: https://claude.ai/desktop
- **Node.js**: https://nodejs.org/

This comprehensive guide should enable AI assistants to effectively help users implement and utilize the Grok Search MCP server with confidence and technical accuracy.