/**
 * 测试Lambda函数
 * 
 * 这个脚本模拟API Gateway请求来测试Lambda函数
 */

// 引入Lambda处理函数
const path = require('path');
const AWS = require('aws-sdk');

// 模拟OptLayer
const mockDbUtils = {
  putItem: async () => ({ success: true }),
  getItem: async () => ({ 
    Item: {
      partition_key: 'user123',
      sort_key: 'profile',
      data: {
        name: '测试用户',
        email: 'test@example.com'
      }
    }
  }),
  queryItems: async () => ({
    Items: [
      {
        partition_key: 'user123',
        sort_key: 'profile',
        data: {
          name: '测试用户',
          email: 'test@example.com'
        }
      }
    ]
  }),
  updateItem: async () => ({ success: true }),
  deleteItem: async () => ({ success: true })
};

const mockTranslateUtils = {
  translateText: async () => 'Translated text',
  getCachedTranslation: async () => null,
  cacheTranslation: async () => ({ success: true })
};

const mockResponseUtils = {
  handleOptions: () => ({
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
    },
    body: JSON.stringify({})
  }),
  validateApiKey: () => null,
  buildResponse: (statusCode, body) => ({
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  })
};

// 初始化环境
process.env.TABLE_NAME = 'user-management-test-table';

// 设置模块路径
const originalRequire = module.require;
module.require = function(id) {
  if (id === '/opt/nodejs/dbUtils') {
    return mockDbUtils;
  } else if (id === '/opt/nodejs/translateUtils') {
    return mockTranslateUtils;
  } else if (id === '/opt/nodejs/responseUtils') {
    return mockResponseUtils;
  }
  return originalRequire.apply(this, arguments);
};

// 引入Lambda处理函数
const lambdaPath = path.resolve(__dirname, '../lambda/index.js');
const { handler } = require(lambdaPath);

// 模拟API Gateway事件
const createEvent = {
  httpMethod: 'POST',
  path: '/items',
  headers: {
    'x-api-key': 'test-api-key'
  },
  body: JSON.stringify({
    partition_key: 'user123',
    sort_key: 'profile',
    data: {
      name: '测试用户',
      email: 'test@example.com'
    }
  })
};

const getEvent = {
  httpMethod: 'GET',
  path: '/items/user123/profile',
  pathParameters: {
    partition_key: 'user123',
    sort_key: 'profile'
  }
};

const updateEvent = {
  httpMethod: 'PUT',
  path: '/items/user123/profile',
  headers: {
    'x-api-key': 'test-api-key'
  },
  pathParameters: {
    partition_key: 'user123',
    sort_key: 'profile'
  },
  body: JSON.stringify({
    data: {
      name: '更新的用户',
      email: 'updated@example.com'
    }
  })
};

const deleteEvent = {
  httpMethod: 'DELETE',
  path: '/items/user123/profile',
  headers: {
    'x-api-key': 'test-api-key'
  },
  pathParameters: {
    partition_key: 'user123',
    sort_key: 'profile'
  }
};

// 运行测试
async function runTests() {
  console.log('开始测试...');
  
  try {
    // 测试创建项目
    console.log('\n测试创建项目:');
    const createResult = await handler(createEvent);
    console.log('结果:', JSON.stringify(createResult, null, 2));
    
    // 测试获取项目
    console.log('\n测试获取项目:');
    const getResult = await handler(getEvent);
    console.log('结果:', JSON.stringify(getResult, null, 2));
    
    // 测试更新项目
    console.log('\n测试更新项目:');
    const updateResult = await handler(updateEvent);
    console.log('结果:', JSON.stringify(updateResult, null, 2));
    
    // 测试删除项目
    console.log('\n测试删除项目:');
    const deleteResult = await handler(deleteEvent);
    console.log('结果:', JSON.stringify(deleteResult, null, 2));
    
    console.log('\n所有测试完成!');
  } catch (error) {
    console.error('测试失败:', error);
    console.error(error.stack);
  }
}

runTests(); 