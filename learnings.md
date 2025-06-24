# MCP Server Development Learnings

## Project: Grok Search MCP Server (twitter-mcp)

### Overview
Successfully built an NPX-compatible MCP server that integrates with xAI's Grok API to provide real-time web search capabilities. The server enables Claude Desktop and other MCP clients to perform live web searches using Grok's advanced AI-powered search functionality.

---

## Key Technical Learnings

### 1. MCP Server Architecture
- **Framework**: Used `@modelcontextprotocol/sdk` for Node.js implementation
- **Transport**: StdioServerTransport for communication with MCP clients
- **Pattern**: Followed rat-mcp template structure for consistency
- **Executable**: NPX compatibility requires proper `bin` field in package.json

### 2. NPX vs Local Path Configuration
**Problem Encountered**: Initial NPM package not found error
```
npm error 404 Not Found - GET https://registry.npmjs.org/grok-search-mcp - Not found
```

**Solutions Available**:
- Option 1: Local path execution (`"command": "node", "args": ["/path/to/index.js"]`)
- Option 2: Global NPM install (`npm install -g .`)
- Option 3: Publish to NPM registry

**Chosen Solution**: Global NPM install for universal NPX compatibility
```bash
npm install -g .
# Enables: npx grok-search-mcp from any directory
```

### 3. Grok API Integration Critical Details

#### Model Name Evolution
- **Wrong**: `"grok-beta"` → 404 "model does not exist" error
- **Correct**: `"grok-3-latest"` → Successful API calls

#### Live Search vs Training Data
**Critical Discovery**: Standard chat completions only return training data (cutoff October 2023)

**Before (Stale Data)**:
```javascript
{
  model: "grok-3-latest",
  messages: [...],
  max_tokens: 2000,
  temperature: 0.1
}
// Returns: "I can only provide information up to my last update in October 2023"
```

**After (Live Search)**:
```javascript
{
  model: "grok-3-latest",
  messages: [...],
  max_tokens: 2000,
  temperature: 0.1,
  search_parameters: {
    mode: "on",                    // Force live search
    return_citations: true,        // Get real URLs
    max_search_results: maxResults,
    sources: [                     // Configure data sources
      {"type": "web"},
      {"type": "news"}, 
      {"type": "x"}
    ]
  }
}
// Returns: Real-time data with current events and citations
```

#### Structured Output for Reliability
**Key Learning**: Request JSON format from Grok for reliable parsing

**System Prompt Pattern**:
```javascript
`Provide current information about the following topic using live search data. Format your response as JSON with this exact structure:
{
  "results": [
    {
      "title": "Article title",
      "snippet": "Brief summary (max 200 characters)",
      "url": "Source URL", 
      "source": "Source name",
      "published_date": "YYYY-MM-DD"
    }
  ],
  "summary": "Brief overview of findings"
}`
```

### 4. Search Source Configuration
Different search types map to different API sources:
- **"web"**: `[{"type": "web"}]`
- **"news"**: `[{"type": "news"}, {"type": "web"}]`
- **"general"**: `[{"type": "web"}, {"type": "news"}, {"type": "x"}]`

### 5. Response Parsing Strategy
**Robust Approach**: JSON parsing with fallback
```javascript
// 1. Try to parse JSON from Grok response
const jsonMatch = content.match(/\{[\s\S]*\}/);
if (jsonMatch) {
  parsedResults = JSON.parse(jsonMatch[0]);
}

// 2. Extract citations from API response object
const citations = response.citations || [];

// 3. Merge parsed results with citations
results = results.map((result, index) => ({
  ...result,
  url: result.url || citations[index] || null
}));

// 4. Fallback if JSON parsing fails
if (!parsedResults) {
  // Create single result with full response
}
```

---

## File Structure & Configuration

### Package.json Requirements
```json
{
  "name": "grok-search-mcp",
  "type": "module",
  "bin": {
    "grok-search-mcp": "./index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.3"
  }
}
```

### Claude Desktop Configuration
```json
{
  "mcpServers": {
    "twitter-mcp": {
      "command": "npx",
      "args": ["grok-search-mcp"], 
      "env": {
        "XAI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### MCP Tools Definition
```javascript
const GROK_SEARCH_TOOLS = [
  {
    name: "grok_search",
    description: "Search the web using Grok's AI-powered search capabilities",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query to execute" },
        search_type: { 
          type: "string", 
          enum: ["web", "news", "general"], 
          default: "web" 
        },
        max_results: { 
          type: "number", 
          default: 10, 
          minimum: 1, 
          maximum: 20 
        }
      },
      required: ["query"]
    }
  }
  // ... additional tools
];
```

---

## Complete Troubleshooting Timeline & History

### Phase 1: Initial Server Setup Issues (First Major Roadblock)

**Problem**: NPM Package Not Found in Claude Desktop
```
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/grok-search-mcp - Not found
npm error 404  'grok-search-mcp@*' is not in this registry.
```

**Root Cause**: Package didn't exist in NPM registry since we built it locally
**Symptoms**: 
- Claude Desktop logs showed "Server transport closed unexpectedly"
- NPX commands failed when Claude Desktop tried to execute them
- Server never initialized properly

**Solution Journey**:
1. **First Attempt**: Tried to fix with local path configuration
2. **Second Attempt**: Considered publishing to NPM registry  
3. **Final Solution**: Global NPM installation (`npm install -g .`)

**Key Learning**: NPX requires either published packages OR global installation for universal access

---

### Phase 2: API Integration Failures (The Model Name Mistake)

**Problem**: Wrong Model Name Usage
```
Error: "The model grok-beta does not exist or your team 76d413d5-32ce-42c9-ad95-931b52a899d4 does not have access to it"
```

**Root Cause**: Used outdated/incorrect model name `"grok-beta"` instead of `"grok-3-latest"`
**Symptoms**:
- 404 API errors on every search request
- Claude Desktop showing error responses in tool outputs
- All three search tools (grok_search, grok_web_search, grok_news_search) failing

**Debugging Process**:
1. Initially thought it was API key issue
2. Checked team permissions and billing
3. Finally discovered model name was wrong through documentation review

**The Fix**: Single line change in index.js
```javascript
// WRONG
model: "grok-beta",

// CORRECT  
model: "grok-3-latest",
```

**Key Learning**: Always verify current model names against latest API documentation

---

### Phase 3: Stale Data Problems (The Live Search Discovery)

**Problem**: Getting Training Data Instead of Current Information
**User Query**: "Secretary Kristi Noem latest news June 2025"
**Wrong Response**: 
```
"I can only provide information up to my last update in October 2023. Since your query is about June 2025, which is in the future, I cannot access or predict news..."
```

**Root Cause**: Missing `search_parameters` field - wasn't enabling live search at all
**Symptoms**:
- All responses referred to training data cutoff
- No real URLs or current information
- Responses mentioned "I cannot access web" or "up to October 2023"

**The Critical Missing Piece**:
```javascript
// BEFORE (Training Data Only)
{
  model: "grok-3-latest",
  messages: [...],
  max_tokens: 2000,
  temperature: 0.1,
  stream: false
}

// AFTER (Live Search Enabled)  
{
  model: "grok-3-latest",
  messages: [...],
  max_tokens: 2000,
  temperature: 0.1,
  stream: false,
  search_parameters: {          // ← THIS WAS MISSING!
    mode: "on",
    return_citations: true,
    max_search_results: maxResults,
    sources: [{"type": "web"}, {"type": "news"}, {"type": "x"}]
  }
}
```

**Key Learning**: Standard chat completions ≠ live search. Must explicitly enable with search_parameters.

---

### Phase 4: Response Parsing Issues (JSON Structure Problems)

**Problem**: Unreliable Text Parsing 
**Symptoms**:
- Inconsistent result extraction
- Missing URLs and citations  
- Poor structured data formatting

**Original Flawed Approach**: 
```javascript
// Tried to parse unstructured text responses
const lines = content.split('\n').filter(line => line.trim());
// Complex regex matching for URLs, titles, etc.
```

**Root Cause**: Grok returned natural language instead of structured data
**Solution**: Request JSON format explicitly in system prompt

**The Fix**:
```javascript
// System prompt requesting structured output
const systemPrompt = `Format your response as JSON with this exact structure:
{
  "results": [
    {
      "title": "Article title",
      "snippet": "Brief summary",
      "url": "Source URL",
      "source": "Source name", 
      "published_date": "YYYY-MM-DD"
    }
  ],
  "summary": "Brief overview of findings"
}`;
```

**Key Learning**: Always request structured output formats when possible for reliable parsing.

---

## Specific Error Messages & Exact Solutions

### Error Pattern #1: NPX Package Resolution
**Exact Error**:
```
(eval):1: command not found: timeout
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/grok-search-mcp - Not found
Server transport closed unexpectedly
```
**Exact Fix**: 
```bash
cd /Users/kairi/grok-search-mcp
npm install -g .
# Verify: npx grok-search-mcp
```

### Error Pattern #2: Model Access Denied
**Exact Error**:
```json
{
  "error": "Search failed: Failed to make API request: API request failed: 404 - {\"code\":\"Some requested entity was not found\",\"error\":\"The model grok-beta does not exist or your team 76d413d5-32ce-42c9-ad95-931b52a899d4 does not have access to it. Please ensure you're using the correct API key.\"}"
}
```
**Exact Fix**: Change model name in index.js line 50
```javascript
model: "grok-3-latest"  // Not "grok-beta"
```

### Error Pattern #3: Stale Training Data  
**Exact Response**:
```json
{
  "snippet": "I'm sorry, but I must clarify that I can only provide information up to my last update in October 2023. Since your query is about \"Secretary Kristi Noem latest news June 2025,\" which is in the future, I cannot access or predict news or events beyond my current data."
}
```
**Exact Fix**: Add search_parameters to API request
```javascript
search_parameters: {
  mode: "on",
  return_citations: true,
  max_search_results: maxResults,
  sources: this.getSearchSources(searchType)
}
```

---

## API Documentation Compliance Checklist

### Before Making API Requests - Verify:
- [ ] **Model Name**: Use current model from [docs.x.ai](https://docs.x.ai/docs/api-reference)
- [ ] **API Key**: Set as XAI_API_KEY environment variable  
- [ ] **Base URL**: Confirm `https://api.x.ai/v1` is correct
- [ ] **Authentication**: Bearer token format

### For Live Search Functionality - Include:
- [ ] **search_parameters object** in request body
- [ ] **mode: "on"** to force live search (not "auto")
- [ ] **return_citations: true** to get source URLs
- [ ] **max_search_results**: Set appropriate limit (1-20)
- [ ] **sources array**: Configure based on search type
  - Web: `[{"type": "web"}]`
  - News: `[{"type": "news"}, {"type": "web"}]` 
  - General: `[{"type": "web"}, {"type": "news"}, {"type": "x"}]`

### For Reliable Response Parsing - Ensure:
- [ ] **JSON format request** in system prompt
- [ ] **Structured schema** provided to Grok
- [ ] **Fallback parsing** for when JSON fails
- [ ] **Citations extraction** from API response object
- [ ] **Error handling** for malformed responses

---

## Claude Desktop Integration Gotchas

### Configuration File Issues
**Problem**: Wrong config file location or format
**Locations to Check**:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%/Claude/claude_desktop_config.json`

**Common Format Mistakes**:
```json
// WRONG - Missing env object
"twitter-mcp": {
  "command": "npx",
  "args": ["grok-search-mcp"],
  "XAI_API_KEY": "key-here"  // ← Wrong placement
}

// CORRECT
"twitter-mcp": {
  "command": "npx", 
  "args": ["grok-search-mcp"],
  "env": {                    // ← Proper env object
    "XAI_API_KEY": "key-here"
  }
}
```

### Environment Variable Propagation
**Problem**: API key not reaching the server process
**Debug Steps**:
1. Check if variable is set: `echo $XAI_API_KEY`
2. Verify in Claude Desktop config: `"env": {"XAI_API_KEY": "..."}`
3. Test direct execution: `XAI_API_KEY=key npx grok-search-mcp`

### Server Restart Requirements
**Problem**: Changes not taking effect
**Required After**:
- Any code changes to index.js
- Global package reinstallation
- Configuration file updates
- Environment variable changes

**Solution**: Always restart Claude Desktop completely

---

## Common Silly Mistakes Prevention Guide

### 🚫 **Mistake #1**: Assuming NPX "Just Works"
**What We Did Wrong**: Expected package to be available without installation
**Prevention**: Always test `npx package-name` before configuring in Claude Desktop

### 🚫 **Mistake #2**: Using Outdated Model Names  
**What We Did Wrong**: Used "grok-beta" without verifying current API docs
**Prevention**: Check model names in latest API documentation before coding

### 🚫 **Mistake #3**: Ignoring Live Search Documentation
**What We Did Wrong**: Implemented basic chat completions thinking it would search
**Prevention**: Read feature-specific docs (live search) not just basic API docs

### 🚫 **Mistake #4**: Complex Text Parsing Instead of Structured Requests
**What We Did Wrong**: Tried to parse natural language responses with regex
**Prevention**: Always request structured formats (JSON/YAML) from AI APIs

### 🚫 **Mistake #5**: Not Testing API Integration Separately
**What We Did Wrong**: Tested everything through Claude Desktop initially  
**Prevention**: Test API calls independently before MCP integration

---

## Step-by-Step Debugging Process

### When MCP Server Fails to Start:
1. **Test NPX Directly**: `npx your-package-name`
2. **Check Global Installation**: `which your-package-name`
3. **Verify Package.json**: Confirm `bin` field is correct
4. **Test with Environment**: `ENV_VAR=value npx your-package-name`

### When API Calls Fail:
1. **Verify Model Name**: Check against current docs
2. **Test API Key**: Make direct curl request
3. **Validate Request Format**: Compare with documentation examples
4. **Check Response Structure**: Log full API responses

### When Getting Wrong Data:
1. **Confirm Live Search**: Verify search_parameters field
2. **Check Sources**: Ensure appropriate source types configured  
3. **Validate Mode**: Use "on" not "auto" for forced search
4. **Review Citations**: Check if response.citations exists

### When Parsing Fails:
1. **Log Raw Responses**: See actual API return format
2. **Test JSON Extraction**: Verify regex and parsing logic
3. **Implement Fallbacks**: Handle cases where JSON fails
4. **Validate Schema**: Ensure requested format matches parsing expectations

---

## Troubleshooting Guide

### Common Issues & Solutions

1. **NPM Package Not Found**
   - **Cause**: Package not published or globally installed
   - **Solution**: `npm install -g .` in project directory

2. **Model Does Not Exist Error** 
   - **Cause**: Wrong model name in API request
   - **Solution**: Use `"grok-3-latest"` instead of `"grok-beta"`

3. **Stale/Training Data Responses**
   - **Cause**: Missing `search_parameters` in API request
   - **Solution**: Add live search configuration with `"mode": "on"`

4. **Inconsistent Response Parsing**
   - **Cause**: Unstructured text responses from Grok
   - **Solution**: Request JSON format in system prompt + robust parsing

5. **Missing Citations/URLs**
   - **Cause**: Not extracting citations from API response object
   - **Solution**: Access `response.citations` array and merge with parsed results

### Testing Commands
```bash
# Test NPX execution
npx grok-search-mcp

# Test with environment variable
XAI_API_KEY=your-key npx grok-search-mcp

# Test MCP protocol
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | XAI_API_KEY=your-key npx grok-search-mcp
```

---

## Performance & Results

### Before vs After Comparison

**Before Implementation**:
- No real-time data access
- Generic responses
- No source attribution
- Training data cutoff limitations

**After Implementation**:
- ✅ Real-time search results (June 2025 current events)
- ✅ Actual URLs from live sources (ABC News, Fox News, etc.)
- ✅ Structured JSON responses
- ✅ Proper citations and source attribution
- ✅ Current event tracking (Secretary Noem hospitalization, etc.)

### Example Success Case
Query: "Secretary Kristi Noem latest news June 2025"

Result:
```json
{
  "results": [
    {
      "title": "DHS Secretary Kristi Noem Hospitalized for Allergic Reaction",
      "snippet": "Secretary of Homeland Security Kristi Noem was hospitalized due to an allergic reaction, as reported on June 17, 2025.",
      "url": "https://abcnews.go.com/Politics/dhs-secretary-kristi-noem-ambulance-hospital-sources/story?id=122948099",
      "source": "ABC News",
      "published_date": "2025-06-17"
    }
  ],
  "citations": ["https://abcnews.go.com/Politics/..."],
  "summary": "Recent news on Secretary Kristi Noem...",
  "source": "grok-live-search"
}
```

---

## Future Considerations

### Potential Enhancements
1. **Date Range Filtering**: Use `from_date` and `to_date` parameters
2. **Geographic Filtering**: Add `country` parameter for localized results
3. **Website Filtering**: Implement `allowed_websites` and `excluded_websites`
4. **RSS Integration**: Add RSS feed sources for specific domains
5. **Caching**: Implement response caching for frequently searched queries

### Scalability Notes
- Rate limiting depends on xAI API plan
- Monitor usage through xAI Developer Portal
- Consider implementing request queuing for high-volume usage

### Security Considerations
- Store API keys securely in environment variables
- Validate and sanitize search queries
- Implement proper error handling to avoid API key exposure

---

## Related Technologies

### Documentation References
- [xAI Live Search Guide](https://docs.x.ai/docs/guides/live-search)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [MCP Server Quickstart](https://modelcontextprotocol.io/quickstart/server.md)

### Dependencies
- `@modelcontextprotocol/sdk`: Core MCP framework
- Node.js 18+: Runtime environment
- NPX: Package execution tool

### Template Projects
- `rat-mcp`: Node.js MCP server template
- `@modelcontextprotocol/server-memory`: Memory server example
- `@modelcontextprotocol/server-brave-search`: Search server reference

---

## Lessons Learned

1. **Read Documentation Thoroughly**: The live search functionality was well-documented but easy to miss
2. **Test NPX Compatibility Early**: Global installation issues can block deployment
3. **Request Structured Responses**: JSON format dramatically improves parsing reliability  
4. **Validate API Integration**: Model names and parameters can change between API versions
5. **Design for Fallbacks**: Robust error handling prevents complete failures
6. **Follow Existing Patterns**: Using proven templates (rat-mcp) accelerates development

---

*This document serves as a comprehensive reference for future MCP server development projects, capturing both technical implementation details and strategic insights gained during the grok-search-mcp development process.*