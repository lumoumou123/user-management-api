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
exports.ApiStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const api_gateway_construct_1 = require("./api-gateway-construct");
/**
 * API堆栈 - 管理API网关和端点
 *
 * 该堆栈负责创建和配置API网关及其路由和集成，用于暴露RESTful API端点。
 */
class ApiStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // 使用自定义构造创建API网关
        this.apiConstruct = new api_gateway_construct_1.ApiGatewayConstruct(this, 'UserApi', {
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
exports.ApiStack = ApiStack;
