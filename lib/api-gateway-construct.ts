import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * API网关构造属性接口
 */
export interface ApiGatewayConstructProps {
  /**
   * 处理API请求的Lambda函数
   */
  handler: lambda.Function;
  /**
   * 是否需要API密钥验证
   */
  requireApiKey?: boolean;
}

/**
 * 自定义API网关构造
 * 
 * 该构造封装了API网关的创建和配置，包括API密钥、路由和集成。
 * 这是一个可重用的组件，可以在不同的堆栈中使用。
 */
export class ApiGatewayConstruct extends Construct {
  /**
   * API网关实例
   */
  public readonly api: apigateway.RestApi;
  
  /**
   * API密钥(如果启用了密钥验证)
   */
  public readonly apiKey?: apigateway.ApiKey;
  
  /**
   * 使用计划(如果启用了密钥验证)
   */
  public readonly usagePlan?: apigateway.UsagePlan;

  constructor(scope: Construct, id: string, props: ApiGatewayConstructProps) {
    super(scope, id);

    // 创建API网关
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: '用户管理API',                // API名称
      description: '用于管理用户数据的RESTful API', // API描述
      defaultCorsPreflightOptions: {             // 配置CORS
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // 允许所有来源
        allowMethods: apigateway.Cors.ALL_METHODS, // 允许所有HTTP方法
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'], // 允许的头部
        maxAge: cdk.Duration.days(1),           // 预检响应的缓存时间
      },
      deployOptions: {
        stageName: 'prod',                       // 部署阶段名称
        loggingLevel: apigateway.MethodLoggingLevel.INFO, // 设置日志级别
        dataTraceEnabled: true,                  // 启用数据跟踪
        metricsEnabled: true,                    // 启用指标
      },
    });
    
    // 如果需要API密钥验证，创建API密钥和使用计划
    if (props.requireApiKey) {
      // 创建API密钥
      this.apiKey = new apigateway.ApiKey(this, 'ApiKey', {
        apiKeyName: 'UserApiKey',                // API密钥名称
        description: '用于访问用户管理API的密钥',  // 密钥描述
        enabled: true,                           // 启用密钥
      });
      
      // 创建使用计划
      this.usagePlan = new apigateway.UsagePlan(this, 'UsagePlan', {
        name: 'UserApiUsagePlan',                // 使用计划名称
        description: '用户管理API的使用计划',      // 计划描述
        apiStages: [
          {
            api: this.api,                       // 关联的API
            stage: this.api.deploymentStage,     // 关联的部署阶段
          },
        ],
        // 可选：设置节流限制
        throttle: {
          rateLimit: 10,                         // 每秒请求数限制
          burstLimit: 20,                        // 突发请求数限制
        },
      });
      
      // 将API密钥添加到使用计划
      this.usagePlan.addApiKey(this.apiKey);
    }

    // 创建API资源和方法
    this.setupApiRoutes(props.handler, props.requireApiKey || false);
  }

  /**
   * 设置API路由和方法
   * @param handler Lambda处理函数
   * @param requireApiKey 是否需要API密钥验证
   */
  private setupApiRoutes(handler: lambda.Function, requireApiKey: boolean): void {
    // 创建Lambda集成
    const lambdaIntegration = new apigateway.LambdaIntegration(handler);
    
    // ✅ 创建数据管理API端点
    const items = this.api.root.addResource('items'); // 创建/items资源
    
    // POST端点 - 创建新项目(添加API密钥保护)
    items.addMethod('POST', lambdaIntegration, {
      apiKeyRequired: requireApiKey // 根据配置决定是否要求API密钥
    });

    const item = items.addResource('{partition_key}'); // 创建/items/{partition_key}资源
    
    // GET端点 - 获取项目集合，带有可选的查询字符串参数
    item.addMethod('GET', lambdaIntegration, {
      requestParameters: {
        'method.request.querystring.filter': false, // 可选的filter查询参数
      }
    });

    const itemWithSortKey = item.addResource('{sort_key}'); // 创建/items/{partition_key}/{sort_key}资源
    
    // GET端点 - 获取单个项目
    itemWithSortKey.addMethod('GET', lambdaIntegration);
    
    // PUT端点 - 更新项目(添加API密钥保护)
    itemWithSortKey.addMethod('PUT', lambdaIntegration, {
      apiKeyRequired: requireApiKey // 根据配置决定是否要求API密钥
    });
    
    // DELETE端点 - 删除项目(添加API密钥保护)
    itemWithSortKey.addMethod('DELETE', lambdaIntegration, {
      apiKeyRequired: requireApiKey // 根据配置决定是否要求API密钥
    });

    // ✅ 创建翻译API端点
    const translation = itemWithSortKey.addResource('translation'); // 创建/items/{partition_key}/{sort_key}/translation资源
    translation.addMethod('GET', lambdaIntegration, {
      requestParameters: {
        'method.request.querystring.language': true, // 必填的language查询参数
      }
    });
    
    // 创建语言支持端点 - 获取支持的语言列表
    const languages = this.api.root.addResource('languages');
    languages.addMethod('GET', lambdaIntegration);
  }
} 