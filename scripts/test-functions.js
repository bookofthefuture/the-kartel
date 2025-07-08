#!/usr/bin/env node

/**
 * Simple test script for local Netlify functions
 * Usage: node scripts/test-functions.js
 */

const baseUrl = 'http://localhost:8888/.netlify/functions';

async function testFunctions() {
  console.log('🧪 Testing Netlify Functions Locally...\n');
  
  const tests = [
    {
      name: 'Get FAQs (Public)',
      url: `${baseUrl}/get-faqs`,
      method: 'GET'
    },
    {
      name: 'Get Venues for Members (Public)',
      url: `${baseUrl}/get-venues-member`,
      method: 'GET'
    }
  ];

  for (const test of tests) {
    try {
      console.log(`🔍 Testing: ${test.name}`);
      
      const response = await fetch(test.url, {
        method: test.method,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const status = response.status;
      const result = await response.text();
      
      if (status === 200) {
        console.log(`✅ ${test.name}: SUCCESS (${status})`);
        
        try {
          const parsed = JSON.parse(result);
          if (parsed.success !== undefined) {
            console.log(`   - Success: ${parsed.success}`);
          }
          if (parsed.count !== undefined) {
            console.log(`   - Count: ${parsed.count}`);
          }
        } catch (e) {
          console.log(`   - Response length: ${result.length} chars`);
        }
      } else {
        console.log(`❌ ${test.name}: FAILED (${status})`);
        console.log(`   - Response: ${result.substring(0, 100)}...`);
      }
      
    } catch (error) {
      console.log(`💥 ${test.name}: ERROR`);
      console.log(`   - ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('🏁 Function testing complete!\n');
  console.log('💡 Tips:');
  console.log('   - Make sure Netlify dev server is running: npm run dev');
  console.log('   - Check environment variables in .env file');
  console.log('   - For authenticated endpoints, add Authorization header');
}

// Run if called directly
if (require.main === module) {
  testFunctions().catch(console.error);
}

module.exports = { testFunctions };