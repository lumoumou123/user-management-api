#!/usr/bin/env node
const AWS = require('aws-sdk');
const { execSync } = require('child_process');

// 配置AWS SDK
const region = process.env.AWS_REGION || 'us-east-1'; // 使用环境变量或默认区域
AWS.config.update({ region });

/**
 * 从CloudFormation堆栈输出中获取DynamoDB表名
 * 如果无法获取，则使用默认的表名作为备选
 * @returns {string} DynamoDB表名
 */
const getTableName = () => {
  try {
    // 使用AWS CLI查询CloudFormation堆栈输出
    const stackOutputs = execSync('aws cloudformation describe-stacks --stack-name UserManagementApiStack --query "Stacks[0].Outputs[?OutputKey==\'ItemTableName\'].OutputValue" --output text').toString().trim();
    return stackOutputs;
  } catch (error) {
    console.error('获取表名时出错:', error.message);
    console.log('使用默认表名 "UserManagementApiStack-ItemTable"');
    return 'UserManagementApiStack-ItemTable'; // 备选默认名称
  }
};

// 初始化DynamoDB文档客户端
const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = getTableName();

// 定义样本数据 - 用于初始化表内容
const sampleData = [
  {
    partition_key: 'user1',
    sort_key: 'profile',
    description: 'This is a sample user profile for John Doe', // 用户1的个人资料
    numeric_value: 100,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    partition_key: 'user1',
    sort_key: 'settings',
    description: 'User preferences include dark mode and email notifications', // 用户1的设置
    numeric_value: 5,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    partition_key: 'user2',
    sort_key: 'profile',
    description: 'Jane Smith is a software developer from Canada', // 用户2的个人资料
    numeric_value: 200,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    partition_key: 'product1',
    sort_key: 'details',
    description: 'Ergonomic office chair with lumbar support and adjustable height', // 产品1的详情
    numeric_value: 29999, // 价格(单位：分)
    is_active: true,
    created_at: new Date().toISOString()
  }
];

/**
 * 将样本数据填充到DynamoDB表中
 * 循环处理每个项目并记录结果
 */
async function seedData() {
  console.log(`正在向表中填充数据: ${TABLE_NAME}`);
  
  for (const item of sampleData) {
    const params = {
      TableName: TABLE_NAME,
      Item: item
    };
    
    try {
      await dynamodb.put(params).promise();
      console.log(`已添加项目: ${item.partition_key}/${item.sort_key}`);
    } catch (error) {
      console.error(`添加项目 ${item.partition_key}/${item.sort_key} 时出错:`, error);
    }
  }
  
  console.log('数据填充完成!');
}

// 运行填充函数并处理可能的错误
seedData().catch(err => {
  console.error('填充过程中出错:', err);
  process.exit(1);
}); 