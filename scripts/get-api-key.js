/**
 * 获取API密钥脚本
 * 
 * 该脚本用于从AWS获取API密钥的值，便于测试API。
 * 它需要AWS CLI配置正确的凭证才能工作。
 */

const { execSync } = require('child_process');
const AWS = require('aws-sdk');

// 解析命令行参数
const args = process.argv.slice(2);
const keyId = args[0] || process.env.API_KEY_ID;

if (!keyId) {
  console.error('错误: 请提供API密钥ID作为参数或设置API_KEY_ID环境变量');
  console.error('用法: node get-api-key.js <API_KEY_ID>');
  process.exit(1);
}

console.log(`正在获取API密钥 (ID: ${keyId})...`);

// 尝试使用AWS SDK获取密钥
async function getApiKeyWithSdk() {
  try {
    const apigateway = new AWS.APIGateway();
    const response = await apigateway.getApiKey({ apiKey: keyId, includeValue: true }).promise();
    return response.value;
  } catch (error) {
    console.error('使用SDK获取API密钥失败:', error.message);
    return null;
  }
}

// 尝试使用AWS CLI获取密钥
function getApiKeyWithCli() {
  try {
    const command = `aws apigateway get-api-key --api-key ${keyId} --include-value --query "value" --output text`;
    return execSync(command).toString().trim();
  } catch (error) {
    console.error('使用CLI获取API密钥失败:', error.message);
    return null;
  }
}

// 主函数
async function main() {
  try {
    let apiKeyValue = await getApiKeyWithSdk();
    
    if (!apiKeyValue) {
      console.log('尝试使用AWS CLI获取API密钥...');
      apiKeyValue = getApiKeyWithCli();
    }
    
    if (apiKeyValue) {
      console.log('\n===== API密钥信息 =====');
      console.log(`API密钥ID: ${keyId}`);
      console.log(`API密钥值: ${apiKeyValue}`);
      console.log('\n使用方法:');
      console.log('在HTTP请求中添加以下标头:');
      console.log('x-api-key: ' + apiKeyValue);
    } else {
      console.error('无法获取API密钥值。请确保您有权限访问此密钥。');
      process.exit(1);
    }
  } catch (error) {
    console.error('获取API密钥时发生错误:', error);
    process.exit(1);
  }
}

main(); 