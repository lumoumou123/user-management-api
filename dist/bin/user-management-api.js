#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const cdk = __importStar(require("aws-cdk-lib"));
const database_stack_1 = require("../lib/database-stack");
const lambda_stack_1 = require("../lib/lambda-stack");
const api_stack_1 = require("../lib/api-stack");
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
const databaseStack = new database_stack_1.DatabaseStack(app, 'UserManagementDatabaseStack', {
    env,
    description: '用户管理API的数据库资源，包括DynamoDB表和索引',
});
// 创建Lambda堆栈(中间层)
const lambdaStack = new lambda_stack_1.LambdaStack(app, 'UserManagementLambdaStack', {
    env,
    description: '用户管理API的Lambda函数和层',
    itemTable: databaseStack.itemTable,
});
// 创建API堆栈(顶层)
const apiStack = new api_stack_1.ApiStack(app, 'UserManagementApiStack', {
    env,
    description: '用户管理API的API网关和路由',
    itemLambda: lambdaStack.itemLambda,
});
// 添加堆栈间依赖关系
lambdaStack.addDependency(databaseStack);
apiStack.addDependency(lambdaStack);
// 添加标签到所有堆栈
const tagAllStacks = (stack) => {
    cdk.Tags.of(stack).add('Project', 'UserManagementAPI');
    cdk.Tags.of(stack).add('Environment', 'Production');
    cdk.Tags.of(stack).add('Owner', 'APITeam');
};
tagAllStacks(databaseStack);
tagAllStacks(lambdaStack);
tagAllStacks(apiStack);
