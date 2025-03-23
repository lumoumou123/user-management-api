import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * 数据库堆栈 - 管理所有数据库相关资源
 * 
 * 该堆栈负责创建和配置DynamoDB表及其索引，用于存储用户管理API的数据。
 */
export class DatabaseStack extends cdk.Stack {
  /**
   * 主DynamoDB表
   */
  public readonly itemTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ✅ 创建 DynamoDB 表 - 用于存储项目数据
    this.itemTable = new dynamodb.Table(this, 'ItemTable', {
      partitionKey: { name: 'partition_key', type: dynamodb.AttributeType.STRING }, // 分区键
      sortKey: { name: 'sort_key', type: dynamodb.AttributeType.STRING },           // 排序键
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 删除堆栈时删除表(仅用于开发环境)
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // 按需计费模式(无需预设容量)
    });

    // 创建全局二级索引(GSI) - 用于存储和检索翻译内容
    this.itemTable.addGlobalSecondaryIndex({
      indexName: 'TranslationIndex',           // 索引名称
      partitionKey: { name: 'original_text', type: dynamodb.AttributeType.STRING }, // 原始文本作为分区键
      sortKey: { name: 'language', type: dynamodb.AttributeType.STRING },           // 语言代码作为排序键
    });
    
    // 导出DynamoDB表名作为CloudFormation输出
    new cdk.CfnOutput(this, 'ItemTableName', {
      value: this.itemTable.tableName,               // DynamoDB表名
      description: '用户管理API的DynamoDB表名',
      exportName: 'UserManagementApiItemTableName', // 可以在其他堆栈中导入的名称
    });
  }
} 