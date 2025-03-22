#!/usr/bin/env node
/**
 * Script to retrieve the API key value
 * 
 * This script fetches the API key ID from CloudFormation outputs
 * and then uses AWS API Gateway to retrieve the full API key value
 */

const AWS = require('aws-sdk');
const { execSync } = require('child_process');

// Configure AWS SDK
const region = process.env.AWS_REGION || 'us-east-1';
AWS.config.update({ region });

// Get the API key ID from CloudFormation outputs
const getApiKeyId = () => {
  try {
    const stackOutputs = execSync('aws cloudformation describe-stacks --stack-name UserManagementApiStack --query "Stacks[0].Outputs[?OutputKey==\'ApiKeyId\'].OutputValue" --output text').toString().trim();
    return stackOutputs;
  } catch (error) {
    console.error('Error getting API key ID:', error.message);
    process.exit(1);
  }
};

// Get the API key value
const getApiKey = async (apiKeyId) => {
  try {
    const apigateway = new AWS.APIGateway();
    const response = await apigateway.getApiKey({
      apiKey: apiKeyId,
      includeValue: true
    }).promise();
    
    return response;
  } catch (error) {
    console.error('Error getting API key:', error.message);
    process.exit(1);
  }
};

// Main function
const main = async () => {
  console.log('Retrieving API key for User Management API...');
  
  // Get API Key ID
  const apiKeyId = getApiKeyId();
  console.log(`API Key ID: ${apiKeyId}`);
  
  if (!apiKeyId) {
    console.error('API Key ID not found. Has the stack been deployed?');
    process.exit(1);
  }
  
  // Get the actual API key value
  const apiKey = await getApiKey(apiKeyId);
  
  console.log('\nAPI Key Information:');
  console.log(`ID: ${apiKey.id}`);
  console.log(`Name: ${apiKey.name}`);
  console.log(`Value: ${apiKey.value}`);
  console.log(`Created: ${apiKey.createdDate}`);
  
  console.log('\nUse the API key in the x-api-key header in your requests to POST and PUT endpoints.');
  console.log('Example:');
  console.log(`curl -X POST https://<api-id>.execute-api.${region}.amazonaws.com/prod/items \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: ${apiKey.value}" \\\n  -d '{"partition_key": "test", "sort_key": "item1", "description": "Test item"}'`);
};

// Run main function
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
}); 