import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { ApiGatewayConstruct } from './api-gateway-construct';

/**
 * API堆栈属性接口
 */
export interface ApiStackProps extends cdk.StackProps {
  /**
   * 处理API请求的Lambda函数
   */
  itemLambda: lambda.Function;
}

/**
 * API堆栈 - 管理API网关和端点
 * 
 * 该堆栈负责创建和配置API网关及其路由和集成，用于暴露RESTful API端点。
 */
export class ApiStack extends cdk.Stack {
  /**
   * API构造实例
   */
  public readonly apiConstruct: ApiGatewayConstruct;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // 使用自定义构造创建API网关
    this.apiConstruct = new ApiGatewayConstruct(this, 'UserApi', {
      handler: props.itemLambda,
      requireApiKey: true, // 启用API密钥验证
    });
    
    // 导出API网关URL作为CloudFormation输出
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiConstruct.api.url,
      description: 'API网关端点URL',
      exportName: 'UserManagementApiUrl',
    });
    
    // 如果启用了API密钥，导出API密钥ID
    if (this.apiConstruct.apiKey) {
      new cdk.CfnOutput(this, 'ApiKeyId', {
        value: this.apiConstruct.apiKey.keyId,
        description: 'API密钥ID，用于保护的端点',
        exportName: 'UserManagementApiKeyId',
      });
    }
  }
} 