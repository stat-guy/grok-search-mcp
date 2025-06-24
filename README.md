# Enhanced Grok Search MCP Server

A robust MCP (Model Context Protocol) server that provides comprehensive web search and analysis capabilities using xAI's Grok API.

## Features

### 🔍 **Search Capabilities**
- **Web Search**: Search general web content using Grok's AI-powered search
- **News Search**: Search for recent news and current events with timeline analysis
- **Twitter/X Search**: Search social media posts with sentiment analysis
- **Date Range Filtering**: Search within specific time periods

### 📊 **Analysis Modes**
- **Basic Mode**: Traditional search results with titles, snippets, and URLs
- **Comprehensive Mode**: Rich analysis including:
  - Detailed timelines of events
  - Direct quotes with full attribution
  - Multiple perspectives and viewpoints
  - Historical context and implications
  - Fact verification status
  - Key findings categorization

### 🛡️ **Reliability Features**
- **Retry Logic**: Automatic retry with exponential backoff for failed requests
- **Request Timeouts**: Configurable timeouts to prevent hanging
- **Graceful Error Handling**: Comprehensive error responses with detailed context
- **Health Monitoring**: Built-in health checks and performance metrics
- **Caching**: Intelligent caching for comprehensive analyses
- **Input Validation**: Enhanced sanitization and validation of all inputs

### 🔧 **Technical Features**
- **NPX Compatible**: Easy installation and usage via NPX
- **MCP Protocol**: Full compatibility with MCP clients like Claude Desktop
- **Structured Logging**: Comprehensive logging for debugging and monitoring
- **Performance Metrics**: Request tracking and success rate monitoring

## Installation

### Simple 3-Step Process
```bash
git clone https://github.com/stat-guy/grok-search-mcp.git
cd grok-search-mcp
npm install -g .
```

### Verify Installation
Test that the installation worked:

```bash
npx grok-search-mcp --help
```

**Success indicator:** If you see `Grok Search MCP Server running on stdio`, your installation is ready!

### Alternative: NPX Usage
```bash
npx grok-search-mcp
```

## Setup

### 1. Get Your xAI API Key

1. Visit the [xAI Developer Portal](https://console.x.ai/)
2. Create an account or sign in
3. Generate your API key
4. Copy the API key for the next step

### 2. Configure Environment Variable

Set your xAI API key as an environment variable:

```bash
export XAI_API_KEY="your-api-key-here"
```

Or create a `.env` file in your project:
```
XAI_API_KEY=your-api-key-here
```

### 3. Configure Claude Desktop

Add the server to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

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

## Available Tools

### `grok_search`
General-purpose search tool with configurable search types and analysis modes.

**Parameters:**
- `query` (required): The search query
- `search_type` (optional): "web", "news", or "general" (default: "web")
- `analysis_mode` (optional): "basic" or "comprehensive" (default: "basic")
- `max_results` (optional): Maximum number of results (1-20, default: 10)
- `from_date` (optional): Start date in YYYY-MM-DD format
- `to_date` (optional): End date in YYYY-MM-DD format

**Basic Mode Example:**
```json
{
  "query": "latest AI developments",
  "search_type": "news",
  "max_results": 5
}
```

**Comprehensive Mode Example:**
```json
{
  "query": "US Iran conflict 2025",
  "search_type": "news",
  "analysis_mode": "comprehensive",
  "max_results": 10,
  "from_date": "2025-06-20",
  "to_date": "2025-06-24"
}
```

### `grok_web_search`
Search general web content with comprehensive analysis support.

**Parameters:**
- `query` (required): The web search query
- `analysis_mode` (optional): "basic" or "comprehensive" (default: "basic")
- `max_results` (optional): Maximum number of results (1-20, default: 10)
- `from_date` (optional): Start date in YYYY-MM-DD format
- `to_date` (optional): End date in YYYY-MM-DD format

### `grok_news_search`
Search for recent news with comprehensive timeline and context analysis.

**Parameters:**
- `query` (required): The news search query
- `analysis_mode` (optional): "basic" or "comprehensive" (default: "basic")
- `max_results` (optional): Maximum number of results (1-20, default: 10)
- `from_date` (optional): Start date in YYYY-MM-DD format
- `to_date` (optional): End date in YYYY-MM-DD format

### `grok_twitter`
Search Twitter/X posts with social media analysis.

**Parameters:**
- `query` (required): The search query for tweets
- `handles` (optional): Array of Twitter handles to filter by (without @ symbol)
- `analysis_mode` (optional): "basic" or "comprehensive" (default: "basic")
- `max_results` (optional): Maximum number of results (1-20, default: 10)
- `from_date` (optional): Start date in YYYY-MM-DD format
- `to_date` (optional): End date in YYYY-MM-DD format

### `health_check`
Check server health and API connectivity status.

**Parameters:** None

## Response Formats

### Basic Mode Response
```json
{
  "query": "search query",
  "analysis_mode": "basic",
  "results": [
    {
      "title": "Result Title",
      "snippet": "Brief description or excerpt",
      "url": "https://example.com",
      "source": "source-name",
      "published_date": "2025-06-24",
      "author": "Author Name",
      "citation_url": "https://example.com",
      "citation_metadata": {
        "domain": "example.com",
        "is_secure": true
      }
    }
  ],
  "citations": ["https://example.com"],
  "summary": "Brief overview of findings",
  "total_results": 5,
  "search_time": "2025-06-24T12:00:00.000Z",
  "source": "grok-live-search"
}
```

### Comprehensive Mode Response
```json
{
  "query": "search query",
  "analysis_mode": "comprehensive",
  "comprehensive_analysis": "Detailed analysis with context and implications...",
  "key_findings": [
    {
      "category": "main_story",
      "title": "Primary Development",
      "content": "Detailed explanation with specifics",
      "sources": ["https://source1.com", "https://source2.com"],
      "confidence": "high"
    }
  ],
  "timeline": [
    {
      "date": "2025-06-21",
      "event": "Initial event occurred",
      "source": "News Source",
      "significance": "This marked the beginning of..."
    }
  ],
  "direct_quotes": [
    {
      "quote": "This is an exact quote from the source",
      "speaker": "Official Name",
      "context": "During a press conference on Monday",
      "source_url": "https://source.com",
      "significance": "This statement clarifies the position..."
    }
  ],
  "related_context": "Historical background and connections...",
  "multiple_perspectives": [
    {
      "viewpoint": "Supporters",
      "content": "Analysis from this perspective",
      "sources": ["https://supporting-source.com"],
      "reasoning": "This group supports because..."
    }
  ],
  "implications": {
    "short_term": "Immediate consequences include...",
    "long_term": "Potential long-term impacts are...",
    "stakeholders_affected": ["Group 1", "Group 2"]
  },
  "verification_status": {
    "confirmed_facts": ["Verified information"],
    "unconfirmed_claims": ["Unverified claims"],
    "contradictory_information": ["Conflicting reports"]
  },
  "raw_results": [
    {
      "title": "Source Article",
      "snippet": "Brief description",
      "url": "https://example.com",
      "relevance_score": 9
    }
  ],
  "summary": "Executive summary of the entire analysis",
  "total_results": 10,
  "search_time": "2025-06-24T12:00:00.000Z",
  "source": "grok-comprehensive-analysis"
}
```

## Configuration

### Environment Variables
- `XAI_API_KEY` (required): Your xAI API key
- `GROK_TIMEOUT` (optional): Request timeout in milliseconds (default: 30000)
- `GROK_MAX_RETRIES` (optional): Maximum retry attempts (default: 3)

### Claude Desktop Configuration Example
```json
{
  "mcpServers": {
    "grok-search": {
      "command": "npx",
      "args": ["grok-search-mcp"],
      "env": {
        "XAI_API_KEY": "your-api-key-here",
        "GROK_TIMEOUT": "45000",
        "GROK_MAX_RETRIES": "5"
      }
    }
  }
}
```

## Error Handling

The server includes comprehensive error handling with standardized error responses:

- **Invalid API Key**: Graceful degradation with clear error messages
- **Empty Query**: Enhanced validation with detailed feedback
- **API Rate Limits**: Automatic retry with exponential backoff
- **Network Issues**: Connection error handling with retry logic
- **Timeout Issues**: Configurable timeouts with clear error reporting
- **JSON Parsing**: Multiple parsing strategies with fallback handling

### Error Response Format
```json
{
  "error": "Detailed error message",
  "status": "failed",
  "query": "original query",
  "search_type": "web",
  "analysis_mode": "basic",
  "timestamp": "2025-06-24T12:00:00.000Z",
  "request_id": "req_1234567890_abc123"
}
```

## Performance Features

### Caching
- **Comprehensive Analysis Caching**: Intelligent caching for expensive comprehensive analyses
- **TTL Management**: Configurable cache expiration (default: 30 minutes)
- **Memory Management**: Automatic cache size limits to prevent memory issues

### Monitoring
- **Health Checks**: Built-in health monitoring with detailed status reporting
- **Performance Metrics**: Request tracking, success rates, and timing analysis
- **Structured Logging**: JSON-formatted logs for easy parsing and monitoring

### Reliability
- **Retry Logic**: Exponential backoff for transient failures
- **Circuit Breaking**: Graceful degradation when API is unavailable
- **Input Sanitization**: Comprehensive input validation and cleaning
- **Error Recovery**: Multiple JSON parsing strategies for robust response handling

## Troubleshooting

### Common Issues

1. **"API service is not available"**
   - Check if XAI_API_KEY is set correctly
   - Verify your API key is valid and active
   - Use the health_check tool to diagnose API connectivity

2. **"Request timeout after Xms"**
   - Increase GROK_TIMEOUT environment variable
   - Check your internet connection
   - Consider using basic mode for faster responses

3. **"Search query too long"**
   - Queries are limited to 1000 characters
   - Break down complex queries into smaller parts

4. **Empty or poor results in comprehensive mode**
   - Try different query phrasings
   - Use basic mode for simple searches
   - Check if the topic has sufficient recent coverage

### Health Monitoring

Use the health_check tool to get detailed status:
```json
{
  "tool": "health_check"
}
```

Example health response:
```json
{
  "server_healthy": true,
  "api_healthy": true,
  "uptime_ms": 3600000,
  "total_requests": 150,
  "error_count": 3,
  "success_rate": "98.00%",
  "api_details": {
    "hasApiKey": true,
    "cacheSize": 12
  }
}
```

### Debugging

The server provides structured logging. Monitor stderr output for detailed logs:
```bash
npx grok-search-mcp 2>debug.log
```

## Testing

Run the test suite to verify functionality:

```bash
# With API key
XAI_API_KEY=your-key npm test

# Basic functionality test (may skip API calls)
npm test
```

## Usage Examples

### Basic News Search
```json
{
  "query": "latest technology news",
  "search_type": "news",
  "max_results": 5
}
```

### Comprehensive Analysis
```json
{
  "query": "climate change policy 2025",
  "analysis_mode": "comprehensive",
  "search_type": "news",
  "from_date": "2025-01-01",
  "max_results": 15
}
```

### Twitter Analysis with Specific Handles
```json
{
  "query": "AI developments",
  "handles": ["elonmusk", "OpenAI", "AnthropicAI"],
  "analysis_mode": "comprehensive",
  "max_results": 10
}
```

### Date-Filtered Web Search
```json
{
  "query": "quantum computing breakthroughs",
  "search_type": "web",
  "from_date": "2025-06-01",
  "to_date": "2025-06-24",
  "max_results": 8
}
```

## API Limits
- Rate limits depend on your xAI API plan
- Monitor usage through the xAI Developer Portal
- Comprehensive mode uses more tokens than basic mode
- Caching helps reduce API usage for repeated queries

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.

## Support

For issues and feature requests, please create an issue in the repository.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Update documentation
6. Submit a pull request

## Changelog

### Version 2.0.0 (Enhanced)
- ✅ Added comprehensive analysis mode with rich context
- ✅ Implemented timeline extraction and direct quotes
- ✅ Added multiple perspectives analysis
- ✅ Enhanced error handling with retry logic
- ✅ Added intelligent caching for comprehensive analyses
- ✅ Implemented health monitoring and performance metrics
- ✅ Added structured logging system
- ✅ Enhanced input validation and sanitization
- ✅ Added configurable timeouts and retry settings
- ✅ Improved JSON parsing with multiple fallback strategies