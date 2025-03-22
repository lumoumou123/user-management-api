import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * 用户管理API的CDK堆栈
 * 包含了API网关、Lambda函数、DynamoDB表和Cognito用户池等AWS资源
 */
export class UserManagementApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ✅ 创建 Cognito 用户池 - 用于用户认证和管理
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'UserManagementPool',       // 用户池名称
      selfSignUpEnabled: true,                  // 允许用户自行注册
      signInAliases: { email: true },           // 使用邮箱作为登录标识符
      autoVerify: { email: true },              // 自动验证邮箱
      standardAttributes: { email: { required: true, mutable: true } }, // 设置必填属性
    });

    // 创建用户池客户端 - 用于应用程序与Cognito用户池的交互
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      generateSecret: false,                    // 不生成客户端密钥
    });

    // ✅ 创建 DynamoDB 表 - 用于存储项目数据
    const itemTable = new dynamodb.Table(this, 'ItemTable', {
      partitionKey: { name: 'partition_key', type: dynamodb.AttributeType.STRING }, // 分区键
      sortKey: { name: 'sort_key', type: dynamodb.AttributeType.STRING },           // 排序键
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 删除堆栈时删除表(仅用于开发环境)
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // 按需计费模式(无需预设容量)
    });

    // 创建全局二级索引(GSI) - 用于存储和检索翻译内容
    itemTable.addGlobalSecondaryIndex({
      indexName: 'TranslationIndex',           // 索引名称
      partitionKey: { name: 'original_text', type: dynamodb.AttributeType.STRING }, // 原始文本作为分区键
      sortKey: { name: 'language', type: dynamodb.AttributeType.STRING },           // 语言代码作为排序键
    });

    // ✅ 创建 Lambda 函数 - 处理API请求
    const itemLambda = new lambda.Function(this, 'ItemLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,     // 使用Node.js 18.x运行时
      handler: 'index.handler',                // 处理函数的入口点
      code: lambda.Code.fromAsset('lambda'),   // Lambda代码目录
      environment: {
        TABLE_NAME: itemTable.tableName,       // 环境变量中设置表名
      },
    });

    // 授予Lambda使用Amazon Translate服务的权限
    itemLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['translate:TranslateText'],    // 允许调用翻译API
      resources: ['*'],                        // 允许访问所有资源
    }));

    // 授予Lambda访问DynamoDB表的读写权限
    itemTable.grantReadWriteData(itemLambda);

    // ✅ 创建API网关 - 暴露RESTful API端点
    const api = new apigateway.RestApi(this, 'UserApi', {
      defaultCorsPreflightOptions: {           // 配置CORS
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // 允许所有来源
        allowMethods: apigateway.Cors.ALL_METHODS, // 允许所有HTTP方法
      },
    });
    
    // 创建API密钥和使用计划 - 为API添加密钥认证
    const apiKey = new apigateway.ApiKey(this, 'ApiKey', {
      apiKeyName: 'UserApiKey',                // API密钥名称
    });
    
    // 创建使用计划 - 管理API密钥的使用
    const usagePlan = new apigateway.UsagePlan(this, 'UsagePlan', {
      name: 'UserApiUsagePlan',                // 使用计划名称
      apiStages: [
        {
          api,                                 // 关联的API
          stage: api.deploymentStage,          // 关联的部署阶段
        },
      ],
    });
    
    // 将API密钥添加到使用计划
    usagePlan.addApiKey(apiKey);

    // ✅ 创建数据管理API端点
    const items = api.root.addResource('items'); // 创建/items资源
    
    // POST端点 - 创建新项目(添加API密钥保护)
    items.addMethod('POST', new apigateway.LambdaIntegration(itemLambda), {
      apiKeyRequired: true // 要求API密钥
    });

    const item = items.addResource('{partition_key}'); // 创建/items/{partition_key}资源
    
    // GET端点 - 获取项目集合，带有可选的查询字符串参数
    item.addMethod('GET', new apigateway.LambdaIntegration(itemLambda), {
      requestParameters: {
        'method.request.querystring.filter': false, // 可选的filter查询参数
      }
    });

    const itemWithSortKey = item.addResource('{sort_key}'); // 创建/items/{partition_key}/{sort_key}资源
    
    // PUT端点 - 更新项目(添加API密钥保护)
    itemWithSortKey.addMethod('PUT', new apigateway.LambdaIntegration(itemLambda), {
      apiKeyRequired: true // 要求API密钥
    });

    // ✅ 创建翻译API端点
    const translation = itemWithSortKey.addResource('translation'); // 创建/items/{partition_key}/{sort_key}/translation资源
    translation.addMethod('GET', new apigateway.LambdaIntegration(itemLambda), {
      requestParameters: {
        'method.request.querystring.language': true, // 必填的language查询参数
      }
    });
    
    // 导出堆栈输出 - 便于部署后访问资源
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,                           // API网关的URL
      description: 'URL of the API Gateway endpoint',
    });
    
    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: apiKey.keyId,                      // API密钥ID
      description: 'ID of the API key for protected endpoints',
    });
    
    new cdk.CfnOutput(this, 'ItemTableName', {
      value: itemTable.tableName,               // DynamoDB表名
      description: 'Name of the DynamoDB table',
    });
  }
}
