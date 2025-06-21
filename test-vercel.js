// Test script for Vercel deployment
const express = require('express');
const app = require('./api/index.js');

const PORT = process.env.PORT || 3000;

// Test the serverless function locally
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Test server running on http://localhost:${PORT}`);
    console.log('📝 Testing Vercel configuration...');
    
    // Test endpoints
    setTimeout(async () => {
      try {
        const response = await fetch(`http://localhost:${PORT}/api/system-info`);
        const data = await response.json();
        console.log('✅ System info endpoint working:', data);
        
        const domainsResponse = await fetch(`http://localhost:${PORT}/api/domains`);
        const domainsData = await domainsResponse.json();
        console.log('✅ Domains endpoint working, found', domainsData.length, 'domains');
        
        console.log('🎉 All tests passed! Ready for Vercel deployment.');
      } catch (error) {
        console.error('❌ Test failed:', error.message);
      }
    }, 2000);
  });
}

module.exports = app; 