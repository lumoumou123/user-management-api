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
exports.DatabaseStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
/**
 * 数据库堆栈 - 管理所有数据库相关资源
 *
 * 该堆栈负责创建和配置DynamoDB表及其索引，用于存储用户管理API的数据。
 */
class DatabaseStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // ✅ 创建 DynamoDB 表 - 用于存储项目数据
        this.itemTable = new dynamodb.Table(this, 'ItemTable', {
            partitionKey: { name: 'partition_key', type: dynamodb.AttributeType.STRING }, // 分区键
            sortKey: { name: 'sort_key', type: dynamodb.AttributeType.STRING }, // 排序键
            removalPolicy: cdk.RemovalPolicy.DESTROY, // 删除堆栈时删除表(仅用于开发环境)
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // 按需计费模式(无需预设容量)
        });
        // 创建全局二级索引(GSI) - 用于存储和检索翻译内容
        this.itemTable.addGlobalSecondaryIndex({
            indexName: 'TranslationIndex', // 索引名称
            partitionKey: { name: 'original_text', type: dynamodb.AttributeType.STRING }, // 原始文本作为分区键
            sortKey: { name: 'language', type: dynamodb.AttributeType.STRING }, // 语言代码作为排序键
        });
        // 导出DynamoDB表名作为CloudFormation输出
        new cdk.CfnOutput(this, 'ItemTableName', {
            value: this.itemTable.tableName, // DynamoDB表名
            description: '用户管理API的DynamoDB表名',
            exportName: 'UserManagementApiItemTableName', // 可以在其他堆栈中导入的名称
        });
    }
}
exports.DatabaseStack = DatabaseStack;
