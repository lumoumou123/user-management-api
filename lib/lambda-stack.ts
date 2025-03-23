import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';
import { Construct } from 'constructs';

/**
 * Lambda堆栈 - 管理所有Lambda相关资源和权限
 * 
 * 该堆栈负责创建和配置Lambda函数、层和权限，用于处理API请求。
 */
export interface LambdaStackProps extends cdk.StackProps {
  /**
   * DynamoDB表实例，用于存储和检索数据
   */
  itemTable: dynamodb.Table;
}

export class LambdaStack extends cdk.Stack {
  /**
   * 主Lambda函数，处理API请求
   */
  public readonly itemLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    // ✅ 创建Lambda层 - 共享通用代码
    const commonLayer = new lambda.LayerVersion(this, 'CommonLayer', {
      code: lambda.Code.fromAsset('lambda-layers/common'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: '包含通用工具函数的层',
    });

    // ✅ 创建 Lambda 函数 - 处理API请求
    this.itemLambda = new lambda.Function(this, 'ItemLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,     // 使用Node.js 18.x运行时
      handler: 'index.handler',                // 处理函数的入口点
      code: lambda.Code.fromAsset('lambda'),   // Lambda代码目录
      environment: {
        TABLE_NAME: props.itemTable.tableName, // 环境变量中设置表名
        NODE_ENV: 'production',                // 设置环境
      },
      layers: [commonLayer],                   // 添加共享层
      timeout: cdk.Duration.seconds(30),       // 设置超时时间为30秒
      memorySize: 256,                         // 分配256MB内存
    });

    // 授予Lambda使用Amazon Translate服务的权限
    this.itemLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['translate:TranslateText', 'translate:ListLanguages'], // 允许调用翻译API
      resources: ['*'],                        // 允许访问所有资源
    }));

    // 授予Lambda访问DynamoDB表的读写权限
    props.itemTable.grantReadWriteData(this.itemLambda);
    
    // 导出Lambda ARN作为CloudFormation输出
    new cdk.CfnOutput(this, 'ItemLambdaArn', {
      value: this.itemLambda.functionArn,
      description: '用户管理API的Lambda函数ARN',
      exportName: 'UserManagementApiItemLambdaArn',
    });
  }
} 