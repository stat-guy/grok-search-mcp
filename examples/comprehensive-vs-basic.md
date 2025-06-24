# Comprehensive vs Basic Analysis Mode Comparison

This guide explains the differences between basic and comprehensive analysis modes in the Grok Search MCP Server and helps you choose the right mode for your needs.

## Mode Overview

### Basic Mode
- **Purpose**: Quick, efficient search results
- **Use Cases**: Simple queries, fast responses, basic information gathering
- **Response Time**: Faster (lower token usage)
- **Token Usage**: ~2000 tokens maximum
- **Output**: Traditional search results with enhanced citations

### Comprehensive Mode  
- **Purpose**: Deep analysis with rich contextual information
- **Use Cases**: Complex research, detailed analysis, comprehensive understanding
- **Response Time**: Slower (higher token usage)
- **Token Usage**: ~4000 tokens maximum
- **Output**: Rich analysis with timelines, quotes, perspectives, and context

## Response Structure Comparison

### Basic Mode Response Format
```json
{
  "query": "search query",
  "analysis_mode": "basic",
  "results": [
    {
      "title": "Article Title",
      "snippet": "Brief description or excerpt",
      "url": "https://source.com",
      "source": "source-name",
      "published_date": "2025-06-24",
      "author": "Author Name",
      "citation_url": "https://source.com",
      "citation_metadata": {
        "domain": "source.com",
        "is_secure": true
      }
    }
  ],
  "citations": ["https://source.com"],
  "summary": "Brief overview of findings",
  "total_results": 5,
  "search_time": "2025-06-24T12:00:00.000Z",
  "source": "grok-live-search"
}
```

### Comprehensive Mode Response Format
```json
{
  "query": "search query",
  "analysis_mode": "comprehensive",
  "comprehensive_analysis": "Detailed 500+ word analysis with context and implications...",
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
      "quote": "Exact quote with proper attribution",
      "speaker": "Person Name",
      "context": "During press conference",
      "source_url": "https://source.com",
      "significance": "This statement clarifies..."
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
    "short_term": "Immediate consequences...",
    "long_term": "Potential long-term impacts...",
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
      "url": "https://source.com",
      "relevance_score": 9
    }
  ],
  "summary": "Executive summary of entire analysis",
  "total_results": 10,
  "search_time": "2025-06-24T12:00:00.000Z",
  "source": "grok-comprehensive-analysis"
}
```

## When to Use Each Mode

### Use Basic Mode When:
- ✅ You need quick results for simple queries
- ✅ You want to minimize API token usage
- ✅ You're doing preliminary research or fact-checking
- ✅ You need specific URLs or recent articles
- ✅ You're searching for basic information or contact details
- ✅ Response time is more important than depth

### Use Comprehensive Mode When:
- ✅ You need deep analysis of complex topics
- ✅ You want historical context and background information
- ✅ You need to understand multiple perspectives on an issue
- ✅ You're researching for detailed reports or analysis
- ✅ You want direct quotes with full attribution
- ✅ You need timeline analysis of events
- ✅ You want fact verification and confidence levels

## Practical Examples

### Example 1: News Event Analysis

**Basic Mode Query:**
```json
{
  "query": "latest political developments",
  "analysis_mode": "basic",
  "search_type": "news",
  "max_results": 5
}
```

**Basic Mode Output:** List of recent news articles with titles, snippets, and URLs

**Comprehensive Mode Query:**
```json
{
  "query": "latest political developments",
  "analysis_mode": "comprehensive", 
  "search_type": "news",
  "max_results": 10
}
```

**Comprehensive Mode Output:** Detailed analysis including timeline of events, direct quotes from officials, multiple political perspectives, historical context, and implications

### Example 2: Twitter Handle Analysis

**Basic Mode - Kevin Durant:**
```json
{
  "query": "basketball commentary",
  "handles": ["KDTrey5"],
  "analysis_mode": "basic",
  "max_results": 10
}
```

**Basic Output:** Recent tweets about basketball with timestamps and URLs

**Comprehensive Mode - Kevin Durant:**
```json
{
  "query": "basketball commentary", 
  "handles": ["KDTrey5"],
  "analysis_mode": "comprehensive",
  "max_results": 15
}
```

**Comprehensive Output:** Analysis of his basketball perspectives, interaction patterns, timeline of posts, direct quotes with context, and analysis of his engagement style

### Example 3: Research Topic

**Basic Mode - Technology Trends:**
```json
{
  "query": "artificial intelligence developments 2025",
  "analysis_mode": "basic",
  "search_type": "web"
}
```

**Basic Output:** List of articles about AI developments

**Comprehensive Mode - Technology Trends:**
```json
{
  "query": "artificial intelligence developments 2025",
  "analysis_mode": "comprehensive",
  "search_type": "web"
}
```

**Comprehensive Output:** Deep analysis of AI trends, timeline of major developments, expert quotes, different industry perspectives, implications for various sectors, and verification of claims

## Performance Considerations

### Speed and Efficiency
| Aspect | Basic Mode | Comprehensive Mode |
|--------|------------|-------------------|
| **Average Response Time** | 3-8 seconds | 8-15 seconds |
| **Token Usage** | ~500-2000 tokens | ~2000-4000 tokens |
| **API Cost** | Lower | Higher |
| **Information Depth** | Surface level | Deep analysis |
| **Cache Hit Rate** | Higher (simple queries) | Lower (complex analysis) |

### Resource Usage
- **Basic Mode**: Ideal for high-frequency queries and cost-conscious usage
- **Comprehensive Mode**: Best for important research where depth matters more than speed

## Best Practices

### Optimization Strategies
1. **Start with Basic**: Use basic mode for initial exploration, then switch to comprehensive for detailed analysis
2. **Query Refinement**: Use basic mode results to refine your query for comprehensive analysis
3. **Cost Management**: Use comprehensive mode strategically for important queries
4. **Time Management**: Allow extra time for comprehensive mode responses

### Query Design
- **Basic Mode**: Use specific, targeted keywords
- **Comprehensive Mode**: Use broader, conceptual queries that benefit from deep analysis

### Result Processing
- **Basic Mode**: Focus on URLs and recent information
- **Comprehensive Mode**: Extract insights from analysis, timeline, and perspectives sections

## Troubleshooting

### If Basic Mode Results Are Insufficient:
- Switch to comprehensive mode for the same query
- Add more specific keywords to your query
- Adjust the time range with from_date/to_date parameters
- Increase max_results for more sources

### If Comprehensive Mode Is Too Slow:
- Use basic mode for preliminary research
- Refine your query to be more specific
- Consider breaking complex queries into smaller parts
- Check if the topic has sufficient recent coverage

### If Results Don't Match Expectations:
- **Basic Mode**: Try different keywords or search types
- **Comprehensive Mode**: Ensure your query is broad enough for analysis
- Both modes: Adjust date ranges or result counts
- Verify your search type (web, news, twitter) matches your content needs

## Migration Between Modes

### Upgrading from Basic to Comprehensive:
```json
// Start with basic
{
  "query": "climate change policy",
  "analysis_mode": "basic"
}

// Upgrade to comprehensive using same query
{
  "query": "climate change policy", 
  "analysis_mode": "comprehensive",
  "max_results": 15
}
```

### Using Both Modes Together:
1. **Phase 1**: Use basic mode to identify key topics and recent developments
2. **Phase 2**: Use comprehensive mode to analyze the most relevant topics in depth
3. **Phase 3**: Combine insights from both modes for complete understanding

This approach maximizes efficiency while ensuring comprehensive coverage of your research needs.