#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { LambdaStack } from '../lib/lambda-stack';
import { ApiStack } from '../lib/api-stack';

/**
 * 用户管理API CDK应用程序
 * 
 * 该应用程序使用多堆栈架构，将资源分为数据存储层、计算层和API层。
 * 这种架构提供了更好的关注点分离和资源组织。
 */
const app = new cdk.App();

// 环境配置
const env = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: process.env.CDK_DEFAULT_REGION 
};

// 创建数据库堆栈(底层)
const databaseStack = new DatabaseStack(app, 'UserManagementDatabaseStack', {
  env,
  description: '用户管理API的数据库资源，包括DynamoDB表和索引',
});

// 创建Lambda堆栈(中间层)
const lambdaStack = new LambdaStack(app, 'UserManagementLambdaStack', {
  env,
  description: '用户管理API的Lambda函数和层',
  itemTable: databaseStack.itemTable,
});

// 创建API堆栈(顶层)
const apiStack = new ApiStack(app, 'UserManagementApiStack', {
  env,
  description: '用户管理API的API网关和路由',
  itemLambda: lambdaStack.itemLambda,
});

// 添加堆栈间依赖关系
lambdaStack.addDependency(databaseStack);
apiStack.addDependency(lambdaStack);

// 添加标签到所有堆栈
const tagAllStacks = (stack: cdk.Stack) => {
  cdk.Tags.of(stack).add('Project', 'UserManagementAPI');
  cdk.Tags.of(stack).add('Environment', 'Production');
  cdk.Tags.of(stack).add('Owner', 'APITeam');
};

tagAllStacks(databaseStack);
tagAllStacks(lambdaStack);
tagAllStacks(apiStack);
