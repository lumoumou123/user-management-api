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
exports.LambdaStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class LambdaStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // ✅ 创建Lambda层 - 共享通用代码
        const commonLayer = new lambda.LayerVersion(this, 'CommonLayer', {
            code: lambda.Code.fromAsset('lambda-layers/common'),
            compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
            description: '包含通用工具函数的层',
        });
        // ✅ 创建 Lambda 函数 - 处理API请求
        this.itemLambda = new lambda.Function(this, 'ItemLambda', {
            runtime: lambda.Runtime.NODEJS_18_X, // 使用Node.js 18.x运行时
            handler: 'index.handler', // 处理函数的入口点
            code: lambda.Code.fromAsset('lambda'), // Lambda代码目录
            environment: {
                TABLE_NAME: props.itemTable.tableName, // 环境变量中设置表名
                NODE_ENV: 'production', // 设置环境
            },
            layers: [commonLayer], // 添加共享层
            timeout: cdk.Duration.seconds(30), // 设置超时时间为30秒
            memorySize: 256, // 分配256MB内存
        });
        // 授予Lambda使用Amazon Translate服务的权限
        this.itemLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['translate:TranslateText', 'translate:ListLanguages'], // 允许调用翻译API
            resources: ['*'], // 允许访问所有资源
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
exports.LambdaStack = LambdaStack;
