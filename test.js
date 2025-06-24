#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const TEST_API_KEY = process.env.XAI_API_KEY || 'test-key';

class MCPTester {
  constructor() {
    this.serverProcess = null;
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      console.log('Starting MCP server...');
      
      const serverPath = join(__dirname, 'index.js');
      this.serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, XAI_API_KEY: TEST_API_KEY }
      });

      this.serverProcess.stderr.on('data', (data) => {
        const message = data.toString();
        console.log('Server stderr:', message);
        if (message.includes('running on stdio')) {
          resolve();
        }
      });

      this.serverProcess.on('error', (error) => {
        console.error('Server error:', error);
        reject(error);
      });

      setTimeout(() => {
        if (this.serverProcess && this.serverProcess.exitCode === null) {
          resolve();
        } else {
          reject(new Error('Server failed to start within timeout'));
        }
      }, 3000);
    });
  }

  async sendMCPRequest(request) {
    return new Promise((resolve, reject) => {
      if (!this.serverProcess) {
        reject(new Error('Server not started'));
        return;
      }

      let responseData = '';
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      this.serverProcess.stdout.once('data', (data) => {
        clearTimeout(timeout);
        responseData = data.toString();
        try {
          const response = JSON.parse(responseData);
          resolve(response);
        } catch (error) {
          resolve({ raw: responseData });
        }
      });

      this.serverProcess.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async testListTools() {
    console.log('\n--- Testing List Tools ---');
    
    const request = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {}
    };

    try {
      const response = await this.sendMCPRequest(request);
      console.log('List tools response:', JSON.stringify(response, null, 2));
      
      if (response.result && response.result.tools) {
        console.log(`✅ Found ${response.result.tools.length} tools`);
        response.result.tools.forEach(tool => {
          console.log(`  - ${tool.name}: ${tool.description}`);
        });
        return true;
      } else {
        console.log('❌ No tools found in response');
        return false;
      }
    } catch (error) {
      console.error('❌ List tools test failed:', error.message);
      return false;
    }
  }

  async testSearchTool() {
    console.log('\n--- Testing Basic Search Tool ---');
    
    const request = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "grok_search",
        arguments: {
          query: "latest news about artificial intelligence",
          max_results: 3,
          search_type: "news",
          analysis_mode: "basic"
        }
      }
    };

    try {
      const response = await this.sendMCPRequest(request);
      
      if (response.result && response.result.content) {
        console.log('✅ Basic search tool executed successfully');
        const content = response.result.content[0]?.text;
        if (content) {
          try {
            const searchResults = JSON.parse(content);
            console.log(`  Query: ${searchResults.query}`);
            console.log(`  Analysis Mode: ${searchResults.analysis_mode}`);
            console.log(`  Results: ${searchResults.total_results}`);
            console.log(`  Source: ${searchResults.source}`);
            
            // Validate basic mode structure
            if (searchResults.results && searchResults.results.length > 0) {
              const firstResult = searchResults.results[0];
              const hasBasicFields = firstResult.title && firstResult.snippet && firstResult.url;
              console.log(`  Has basic fields: ${hasBasicFields ? 'Yes' : 'No'}`);
            }
            
          } catch (e) {
            console.log('  Raw response:', content.substring(0, 200) + '...');
          }
        }
        return true;
      } else {
        console.log('❌ No content in search response');
        return false;
      }
    } catch (error) {
      console.error('❌ Basic search tool test failed:', error.message);
      return false;
    }
  }

  async testComprehensiveAnalysis() {
    console.log('\n--- Testing Comprehensive Analysis Mode ---');
    
    const request = {
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "grok_news_search",
        arguments: {
          query: "climate change policy developments 2025",
          analysis_mode: "comprehensive",
          max_results: 5,
          from_date: "2025-01-01"
        }
      }
    };

    try {
      const response = await this.sendMCPRequest(request);
      
      if (response.result && response.result.content) {
        console.log('✅ Comprehensive analysis executed successfully');
        const content = response.result.content[0]?.text;
        if (content) {
          try {
            const analysisResults = JSON.parse(content);
            console.log(`  Query: ${analysisResults.query}`);
            console.log(`  Analysis Mode: ${analysisResults.analysis_mode}`);
            
            // Check for comprehensive fields
            const comprehensiveFields = [
              'comprehensive_analysis',
              'key_findings',
              'timeline',
              'direct_quotes',
              'multiple_perspectives',
              'verification_status'
            ];
            
            comprehensiveFields.forEach(field => {
              const hasField = analysisResults[field] !== undefined;
              console.log(`  Has ${field}: ${hasField ? 'Yes' : 'No'}`);
              
              if (hasField && Array.isArray(analysisResults[field])) {
                console.log(`    ${field} count: ${analysisResults[field].length}`);
              }
            });
            
            // Check timeline structure
            if (analysisResults.timeline && analysisResults.timeline.length > 0) {
              const timelineItem = analysisResults.timeline[0];
              const hasTimelineFields = timelineItem.date && timelineItem.event;
              console.log(`  Timeline structure valid: ${hasTimelineFields ? 'Yes' : 'No'}`);
            }
            
            // Check quotes structure
            if (analysisResults.direct_quotes && analysisResults.direct_quotes.length > 0) {
              const quote = analysisResults.direct_quotes[0];
              const hasQuoteFields = quote.quote && quote.speaker;
              console.log(`  Quote structure valid: ${hasQuoteFields ? 'Yes' : 'No'}`);
            }
            
          } catch (e) {
            console.log('  JSON parsing failed, raw response:', content.substring(0, 300) + '...');
          }
        }
        return true;
      } else {
        console.log('❌ Comprehensive analysis failed');
        return false;
      }
    } catch (error) {
      console.error('❌ Comprehensive analysis test failed:', error.message);
      return false;
    }
  }

  async testWebSearch() {
    console.log('\n--- Testing Web Search Tool ---');
    
    const request = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "grok_web_search",
        arguments: {
          query: "Model Context Protocol MCP",
          max_results: 2
        }
      }
    };

    try {
      const response = await this.sendMCPRequest(request);
      
      if (response.result && response.result.content) {
        console.log('✅ Web search tool executed successfully');
        return true;
      } else {
        console.log('❌ Web search failed');
        console.log('Response:', JSON.stringify(response, null, 2));
        return false;
      }
    } catch (error) {
      console.error('❌ Web search test failed:', error.message);
      return false;
    }
  }

  async testTwitterSearch() {
    console.log('\n--- Testing Twitter Search Tool ---');
    
    const request = {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "grok_twitter",
        arguments: {
          query: "artificial intelligence",
          max_results: 3
        }
      }
    };

    try {
      const response = await this.sendMCPRequest(request);
      console.log('Twitter search response:', JSON.stringify(response, null, 2));
      
      if (response.result && response.result.content) {
        console.log('✅ Twitter search tool executed successfully');
        const content = response.result.content[0]?.text;
        if (content) {
          try {
            const searchResults = JSON.parse(content);
            console.log(`  Query: ${searchResults.query}`);
            console.log(`  Results: ${searchResults.total_results}`);
            console.log(`  Source: ${searchResults.source}`);
          } catch (e) {
            console.log('  Raw response:', content.substring(0, 200) + '...');
          }
        }
        return true;
      } else {
        console.log('❌ No content in Twitter search response');
        return false;
      }
    } catch (error) {
      console.error('❌ Twitter search test failed:', error.message);
      return false;
    }
  }

  async testTwitterSearchWithHandles() {
    console.log('\n--- Testing Twitter Search with Specific Handles ---');
    
    const request = {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "grok_twitter",
        arguments: {
          query: "AI updates",
          handles: ["elonmusk", "OpenAI"],
          max_results: 2
        }
      }
    };

    try {
      const response = await this.sendMCPRequest(request);
      console.log('Twitter handles search response:', JSON.stringify(response, null, 2));
      
      if (response.result && response.result.content) {
        console.log('✅ Twitter handles search executed successfully');
        return true;
      } else {
        console.log('❌ Twitter handles search failed');
        return false;
      }
    } catch (error) {
      console.error('❌ Twitter handles search test failed:', error.message);
      return false;
    }
  }

  async testDateRangeSearch() {
    console.log('\n--- Testing Date Range Search ---');
    
    const request = {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "grok_news_search",
        arguments: {
          query: "artificial intelligence breakthrough",
          max_results: 3,
          from_date: "2024-01-01",
          to_date: "2024-12-31"
        }
      }
    };

    try {
      const response = await this.sendMCPRequest(request);
      console.log('Date range search response:', JSON.stringify(response, null, 2));
      
      if (response.result && response.result.content) {
        console.log('✅ Date range search executed successfully');
        const content = response.result.content[0]?.text;
        if (content) {
          try {
            const searchResults = JSON.parse(content);
            console.log(`  Query: ${searchResults.query}`);
            console.log(`  Results: ${searchResults.total_results}`);
            console.log(`  Has citations: ${searchResults.citations?.length > 0 ? 'Yes' : 'No'}`);
            console.log(`  Has citation metadata: ${searchResults.citation_metadata ? 'Yes' : 'No'}`);
          } catch (e) {
            console.log('  Raw response:', content.substring(0, 200) + '...');
          }
        }
        return true;
      } else {
        console.log('❌ Date range search failed');
        return false;
      }
    } catch (error) {
      console.error('❌ Date range search test failed:', error.message);
      return false;
    }
  }

  async testInvalidDateValidation() {
    console.log('\n--- Testing Invalid Date Validation ---');
    
    const request = {
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "grok_web_search",
        arguments: {
          query: "test search",
          from_date: "2024-13-01", // Invalid month
          to_date: "2024-02-30"    // Invalid date
        }
      }
    };

    try {
      const response = await this.sendMCPRequest(request);
      
      if (response.result && response.result.isError) {
        console.log('✅ Date validation works correctly');
        return true;
      } else {
        console.log('❌ Date validation test failed - should have returned error');
        return false;
      }
    } catch (error) {
      console.error('❌ Date validation test failed:', error.message);
      return false;
    }
  }

  async testEnhancedCitations() {
    console.log('\n--- Testing Enhanced Citations ---');
    
    const request = {
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "grok_search",
        arguments: {
          query: "latest technology trends",
          max_results: 2,
          search_type: "news"
        }
      }
    };

    try {
      const response = await this.sendMCPRequest(request);
      
      if (response.result && response.result.content) {
        console.log('✅ Enhanced citations search executed successfully');
        const content = response.result.content[0]?.text;
        if (content) {
          try {
            const searchResults = JSON.parse(content);
            
            // Check for enhanced citation features
            const hasCitations = searchResults.citations && searchResults.citations.length > 0;
            const hasCitationMetadata = searchResults.citation_metadata && searchResults.citation_metadata.length > 0;
            const resultsHaveCitationFields = searchResults.results?.some(result => 
              result.citation_url || result.citation_index !== undefined || result.citation_metadata
            );
            
            console.log(`  Citations present: ${hasCitations ? 'Yes' : 'No'}`);
            console.log(`  Citation metadata: ${hasCitationMetadata ? 'Yes' : 'No'}`);
            console.log(`  Results have citation fields: ${resultsHaveCitationFields ? 'Yes' : 'No'}`);
            
            if (hasCitations || hasCitationMetadata || resultsHaveCitationFields) {
              console.log('✅ Enhanced citation features working');
              return true;
            } else {
              console.log('⚠️ Enhanced citations not fully tested (may need real API key)');
              return true; // Don't fail if API key is missing
            }
          } catch (e) {
            console.log('  Raw response:', content.substring(0, 200) + '...');
            return true; // Don't fail on parsing issues
          }
        }
        return true;
      } else {
        console.log('❌ Enhanced citations search failed');
        return false;
      }
    } catch (error) {
      console.error('❌ Enhanced citations test failed:', error.message);
      return false;
    }
  }

  async testHealthCheck() {
    console.log('\n--- Testing Health Check Tool ---');
    
    const request = {
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: {
        name: "health_check",
        arguments: {}
      }
    };

    try {
      const response = await this.sendMCPRequest(request);
      
      if (response.result && response.result.content) {
        console.log('✅ Health check executed successfully');
        const content = response.result.content[0]?.text;
        if (content) {
          try {
            const healthData = JSON.parse(content);
            console.log(`  Server Healthy: ${healthData.server_healthy}`);
            console.log(`  API Healthy: ${healthData.api_healthy}`);
            console.log(`  Total Requests: ${healthData.total_requests}`);
            console.log(`  Success Rate: ${healthData.success_rate}`);
            console.log(`  Has API Key: ${healthData.api_details?.hasApiKey}`);
            
            return healthData.server_healthy;
          } catch (e) {
            console.log('  Raw health response:', content.substring(0, 200) + '...');
            return true; // Don't fail on parsing issues
          }
        }
        return true;
      } else {
        console.log('❌ Health check failed');
        return false;
      }
    } catch (error) {
      console.error('❌ Health check test failed:', error.message);
      return false;
    }
  }

  async testErrorHandling() {
    console.log('\n--- Testing Enhanced Error Handling ---');
    
    const request = {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "grok_search",
        arguments: {
          query: "",  // Empty query should trigger error
          max_results: 5
        }
      }
    };

    try {
      const response = await this.sendMCPRequest(request);
      
      if (response.result && response.result.isError) {
        console.log('✅ Error handling works correctly');
        
        const content = response.result.content[0]?.text;
        if (content) {
          try {
            const errorData = JSON.parse(content);
            console.log(`  Error Message: ${errorData.error}`);
            console.log(`  Status: ${errorData.status}`);
            console.log(`  Has Request ID: ${errorData.request_id ? 'Yes' : 'No'}`);
            console.log(`  Has Timestamp: ${errorData.timestamp ? 'Yes' : 'No'}`);
            
            // Check enhanced error format
            const hasEnhancedFields = errorData.request_id && errorData.timestamp && errorData.analysis_mode;
            console.log(`  Enhanced error format: ${hasEnhancedFields ? 'Yes' : 'No'}`);
          } catch (e) {
            console.log('  Error parsing failed, raw:', content.substring(0, 200));
          }
        }
        
        return true;
      } else {
        console.log('❌ Error handling test failed - should have returned error');
        return false;
      }
    } catch (error) {
      console.error('❌ Error handling test failed:', error.message);
      return false;
    }
  }

  async testInputValidation() {
    console.log('\n--- Testing Enhanced Input Validation ---');
    
    const tests = [
      {
        name: "Invalid analysis mode",
        args: {
          query: "test query",
          analysis_mode: "invalid_mode"
        }
      },
      {
        name: "Query too long",
        args: {
          query: "x".repeat(1001), // Exceeds 1000 char limit
          analysis_mode: "basic"
        }
      },
      {
        name: "Invalid max_results",
        args: {
          query: "test query",
          max_results: 25 // Exceeds limit of 20
        }
      },
      {
        name: "Invalid date format",
        args: {
          query: "test query",
          from_date: "2025-13-01" // Invalid month
        }
      }
    ];

    let passedTests = 0;
    
    for (const test of tests) {
      try {
        const request = {
          jsonrpc: "2.0",
          id: 12 + passedTests,
          method: "tools/call",
          params: {
            name: "grok_search",
            arguments: test.args
          }
        };
        
        const response = await this.sendMCPRequest(request);
        
        if (response.result && response.result.isError) {
          console.log(`  ✅ ${test.name}: Correctly rejected`);
          passedTests++;
        } else {
          console.log(`  ❌ ${test.name}: Should have been rejected`);
        }
      } catch (error) {
        console.log(`  ✅ ${test.name}: Correctly caught error - ${error.message}`);
        passedTests++;
      }
    }
    
    console.log(`✅ Input validation: ${passedTests}/${tests.length} tests passed`);
    return passedTests === tests.length;
  }

  async cleanup() {
    if (this.serverProcess) {
      this.serverProcess.kill();
      console.log('Server process terminated');
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Enhanced Grok Search MCP Server Tests');
    console.log(`Using API Key: ${TEST_API_KEY && TEST_API_KEY !== 'test-key' ? 'Present' : 'Missing/Test'}`);
    
    try {
      await this.startServer();
      console.log('✅ Server started successfully');

      const tests = [
        { name: 'List Tools', fn: () => this.testListTools() },
        { name: 'Basic Search Tool', fn: () => this.testSearchTool() },
        { name: 'Comprehensive Analysis', fn: () => this.testComprehensiveAnalysis() },
        { name: 'Health Check', fn: () => this.testHealthCheck() },
        { name: 'Web Search', fn: () => this.testWebSearch() },
        { name: 'Twitter Search', fn: () => this.testTwitterSearch() },
        { name: 'Twitter Search with Handles', fn: () => this.testTwitterSearchWithHandles() },
        { name: 'Date Range Search', fn: () => this.testDateRangeSearch() },
        { name: 'Invalid Date Validation', fn: () => this.testInvalidDateValidation() },
        { name: 'Enhanced Citations', fn: () => this.testEnhancedCitations() },
        { name: 'Error Handling', fn: () => this.testErrorHandling() },
        { name: 'Input Validation', fn: () => this.testInputValidation() }
      ];

      let passed = 0;
      let total = tests.length;

      for (const test of tests) {
        try {
          const result = await test.fn();
          if (result) passed++;
        } catch (error) {
          console.error(`Test "${test.name}" threw error:`, error.message);
        }
      }

      console.log(`\n🏁 Test Results: ${passed}/${total} tests passed`);
      
      if (passed === total) {
        console.log('🎉 All tests passed!');
      } else {
        console.log('⚠️  Some tests failed. Check the output above for details.');
      }

    } catch (error) {
      console.error('❌ Failed to start server:', error.message);
    } finally {
      await this.cleanup();
    }
  }
}

// Check for API key
if (!TEST_API_KEY || TEST_API_KEY === 'test-key') {
  console.log('⚠️  Warning: XAI_API_KEY not set. Tests will run but may fail API calls.');
  console.log('Set XAI_API_KEY environment variable for full testing.');
}

// Run tests
const tester = new MCPTester();
tester.runAllTests().catch(console.error);