import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export class UserManagementApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ✅ 创建 Cognito 用户池
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'UserManagementPool',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      generateSecret: false,
    });

    // ✅ 创建 DynamoDB 表
    const itemTable = new dynamodb.Table(this, 'ItemTable', {
      partitionKey: { name: 'partition_key', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sort_key', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ✅ 创建 Lambda 函数
    const itemLambda = new lambda.Function(this, 'ItemLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment: {
        TABLE_NAME: itemTable.tableName,
      },
    });

    // 赋予 Lambda 访问 DynamoDB 权限
    itemTable.grantReadWriteData(itemLambda);

    // ✅ 创建 API Gateway
    const api = new apigateway.RestApi(this, 'UserApi');

    // ✅ 受保护数据管理 API
    const items = api.root.addResource('items');
    items.addMethod('POST', new apigateway.LambdaIntegration(itemLambda));

    const item = items.addResource('{partition_key}');
    item.addMethod('GET', new apigateway.LambdaIntegration(itemLambda));

    const itemWithSortKey = item.addResource('{sort_key}');
    itemWithSortKey.addMethod('PUT', new apigateway.LambdaIntegration(itemLambda));

    // ✅ 翻译 API
    const translation = itemWithSortKey.addResource('translation');
    translation.addMethod('GET', new apigateway.LambdaIntegration(itemLambda));
  }
}
