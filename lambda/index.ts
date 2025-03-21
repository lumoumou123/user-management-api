import { APIGatewayEvent, Context } from 'aws-lambda';
import * as AWS from 'aws-sdk';

// 初始化AWS服务客户端
const dynamodb = new AWS.DynamoDB.DocumentClient(); // DynamoDB文档客户端
const translate = new AWS.Translate();              // Amazon Translate服务客户端
const TABLE_NAME = process.env.TABLE_NAME!;         // 从环境变量获取表名

/**
 * Lambda处理函数 - 处理API Gateway的请求
 * 根据HTTP方法和路径参数路由到不同的处理函数
 * @param event API Gateway事件对象
 * @param context Lambda上下文
 * @returns HTTP响应对象
 */
export async function handler(event: APIGatewayEvent, context: Context) {
    console.log('收到事件:', JSON.stringify(event, null, 2));
    
    try {
        const httpMethod = event.httpMethod;                 // 获取HTTP方法(GET, POST, PUT等)
        const pathParameters = event.pathParameters || {};   // 获取路径参数
        const queryParameters = event.queryStringParameters || {}; // 获取查询字符串参数
        const body = event.body ? JSON.parse(event.body) : {}; // 解析请求体JSON

        // 路由请求到相应的处理函数
        // 1. 创建项目的POST请求
        if (httpMethod === 'POST') {
            return createItem(body);
        }
        
        // 2. 获取项目集合的GET请求(带可选的过滤参数)
        if (httpMethod === 'GET' && pathParameters.partition_key && !pathParameters.sort_key) {
            return getItems(pathParameters.partition_key, queryParameters.filter);
        }
        
        // 3. 更新项目的PUT请求
        if (httpMethod === 'PUT' && pathParameters.partition_key && pathParameters.sort_key) {
            return updateItem(pathParameters, body);
        }
        
        // 4. 获取翻译的GET请求
        if (httpMethod === 'GET' && pathParameters.partition_key && pathParameters.sort_key && event.resource.endsWith('/translation')) {
            const language = queryParameters.language;
            if (!language) {
                return {
                    statusCode: 400,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({ message: '必须提供language参数' })
                };
            }
            return getTranslation(pathParameters, language);
        }

        // 处理无效请求
        return {
            statusCode: 400,
            headers: getCorsHeaders(),
            body: JSON.stringify({ message: '无效请求' })
        };
    } catch (error) {
        // 处理异常
        console.error('错误:', error);
        return {
            statusCode: 500,
            headers: getCorsHeaders(),
            body: JSON.stringify({ message: '服务器内部错误', error: (error as Error).message })
        };
    }
}

/**
 * 创建新项目
 * @param data 项目数据
 * @returns HTTP响应
 */
async function createItem(data: any) {
    // 验证输入数据
    if (!data.partition_key || !data.sort_key || !data.description) {
        return {
            statusCode: 400,
            headers: getCorsHeaders(),
            body: JSON.stringify({ message: '缺少必填字段: partition_key, sort_key, 和 description 为必填项' })
        };
    }

    // 构建项目对象
    const item = {
        partition_key: data.partition_key,         // 分区键
        sort_key: data.sort_key,                   // 排序键
        description: data.description,             // 描述文本(支持翻译)
        numeric_value: data.numeric_value || 0,    // 数值字段(可选)
        is_active: data.is_active !== undefined ? data.is_active : true, // 布尔字段(可选)
        created_at: new Date().toISOString()       // 创建时间戳
    };

    // 保存到DynamoDB
    await dynamodb.put({
        TableName: TABLE_NAME,
        Item: item
    }).promise();

    // 返回成功响应
    return {
        statusCode: 201,
        headers: getCorsHeaders(),
        body: JSON.stringify({ message: '项目创建成功', item })
    };
}

/**
 * 获取项目集合
 * @param partition_key 分区键
 * @param filter 可选的描述过滤条件
 * @returns HTTP响应
 */
async function getItems(partition_key: string, filter?: string) {
    // 构建查询参数
    const params: AWS.DynamoDB.DocumentClient.QueryInput = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'partition_key = :pk',  // 键条件表达式
        ExpressionAttributeValues: {
            ':pk': partition_key                        // 分区键值
        }
    };
    
    // 如果指定了过滤条件，应用过滤表达式
    if (filter) {
        params.FilterExpression = 'contains(description, :filter)'; // 过滤表达式(检查描述文本是否包含过滤词)
        params.ExpressionAttributeValues![':filter'] = filter;      // 过滤值
    }
    
    // 执行查询
    const result = await dynamodb.query(params).promise();
    
    // 返回结果
    return {
        statusCode: 200,
        headers: getCorsHeaders(),
        body: JSON.stringify(result.Items || [])
    };
}

/**
 * 更新现有项目
 * @param keys 项目键(分区键和排序键)
 * @param data 更新数据
 * @returns HTTP响应
 */
async function updateItem(keys: any, data: any) {
    // 验证是否有要更新的字段
    if (!data.description && data.numeric_value === undefined && data.is_active === undefined) {
        return {
            statusCode: 400,
            headers: getCorsHeaders(),
            body: JSON.stringify({ message: '至少需要一个更新字段' })
        };
    }
    
    // 动态构建更新表达式
    let updateExpression = 'SET ';
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};
    
    // 处理描述字段更新
    if (data.description !== undefined) {
        updateExpression += '#desc = :description, ';
        expressionAttributeValues[':description'] = data.description;
        expressionAttributeNames['#desc'] = 'description';  // 使用表达式属性名来处理保留字
    }
    
    // 处理数值字段更新
    if (data.numeric_value !== undefined) {
        updateExpression += 'numeric_value = :numVal, ';
        expressionAttributeValues[':numVal'] = data.numeric_value;
    }
    
    // 处理布尔字段更新
    if (data.is_active !== undefined) {
        updateExpression += 'is_active = :isActive, ';
        expressionAttributeValues[':isActive'] = data.is_active;
    }
    
    // 添加更新时间戳
    updateExpression += 'updated_at = :updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();
    
    // 执行更新
    await dynamodb.update({
        TableName: TABLE_NAME,
        Key: { 
            partition_key: keys.partition_key, 
            sort_key: keys.sort_key 
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames
    }).promise();

    // 返回成功响应
    return {
        statusCode: 200,
        headers: getCorsHeaders(),
        body: JSON.stringify({ message: '项目更新成功' })
    };
}

/**
 * 获取项目描述的翻译
 * @param keys 项目键(分区键和排序键)
 * @param language 目标语言代码(如 'zh', 'fr', 'es')
 * @returns HTTP响应
 */
async function getTranslation(keys: any, language: string | undefined) {
    if (!language) {
        return {
            statusCode: 400,
            headers: getCorsHeaders(),
            body: JSON.stringify({ message: '必须提供language参数' })
        };
    }
    
    // 首先检查是否已有缓存的翻译
    const cachedTranslation = await checkCachedTranslation(keys.partition_key, keys.sort_key, language);
    if (cachedTranslation) {
        // 如果有缓存翻译，直接返回
        return {
            statusCode: 200,
            headers: getCorsHeaders(),
            body: JSON.stringify({
                original_item: cachedTranslation.original_item,
                translated_text: cachedTranslation.translated_text,
                language: language,
                source: 'cache'  // 标记来源为缓存
            })
        };
    }
    
    // 如果没有缓存，获取原始项目
    const response = await dynamodb.get({
        TableName: TABLE_NAME,
        Key: { 
            partition_key: keys.partition_key, 
            sort_key: keys.sort_key 
        }
    }).promise();
    
    const item = response.Item;
    if (!item) {
        return {
            statusCode: 404,
            headers: getCorsHeaders(),
            body: JSON.stringify({ message: '项目不存在' })
        };
    }
    
    // 使用Amazon Translate服务进行翻译
    try {
        const translateResult = await translate.translateText({
            Text: item.description,
            SourceLanguageCode: 'auto',            // 自动检测源语言
            TargetLanguageCode: language           // 目标语言
        }).promise();
        
        // 缓存翻译结果以备将来使用
        await cacheTranslation(
            item, 
            translateResult.TranslatedText || '', 
            language,
            translateResult.SourceLanguageCode || 'en'
        );
        
        // 返回翻译结果
        return {
            statusCode: 200,
            headers: getCorsHeaders(),
            body: JSON.stringify({
                original_item: item,
                translated_text: translateResult.TranslatedText,
                language: language,
                detected_source_language: translateResult.SourceLanguageCode,
                source: 'new_translation'  // 标记来源为新翻译
            })
        };
    } catch (error) {
        // 处理翻译错误
        console.error('翻译错误:', error);
        return {
            statusCode: 500,
            headers: getCorsHeaders(),
            body: JSON.stringify({ 
                message: '翻译文本时出错',
                error: (error as Error).message
            })
        };
    }
}

/**
 * 检查是否存在缓存的翻译
 * @param partitionKey 分区键
 * @param sortKey 排序键
 * @param language 目标语言
 * @returns 缓存的翻译，如果没有则返回null
 */
async function checkCachedTranslation(partitionKey: string, sortKey: string, language: string) {
    // 首先获取原始项目以获取其描述
    const originalItem = await dynamodb.get({
        TableName: TABLE_NAME,
        Key: { 
            partition_key: partitionKey, 
            sort_key: sortKey 
        }
    }).promise();
    
    if (!originalItem.Item || !originalItem.Item.description) {
        return null;
    }
    
    // 检查是否有此翻译的缓存
    // 使用原始文本和语言构建缓存键
    const cacheKey = `TRANSLATION#${originalItem.Item.description}#${language}`;
    const cachedTranslation = await dynamodb.get({
        TableName: TABLE_NAME,
        Key: {
            partition_key: cacheKey,
            sort_key: 'TRANSLATION'
        }
    }).promise();
    
    // 如果找到缓存，返回原始项目和翻译文本
    if (cachedTranslation.Item && cachedTranslation.Item.translated_text) {
        return {
            original_item: originalItem.Item,
            translated_text: cachedTranslation.Item.translated_text
        };
    }
    
    return null;
}

/**
 * 缓存翻译结果到DynamoDB
 * @param originalItem 原始项目
 * @param translatedText 翻译后的文本
 * @param targetLanguage 目标语言
 * @param sourceLanguage 源语言
 */
async function cacheTranslation(
    originalItem: any, 
    translatedText: string, 
    targetLanguage: string,
    sourceLanguage: string
) {
    // 构建缓存键
    const cacheKey = `TRANSLATION#${originalItem.description}#${targetLanguage}`;
    
    // 存储翻译到DynamoDB
    await dynamodb.put({
        TableName: TABLE_NAME,
        Item: {
            partition_key: cacheKey,                 // 分区键(原始文本+语言)
            sort_key: 'TRANSLATION',                 // 排序键(固定值)
            original_text: originalItem.description, // 原始文本
            translated_text: translatedText,         // 翻译后的文本
            source_language: sourceLanguage,         // 源语言
            target_language: targetLanguage,         // 目标语言
            original_item_reference: {               // 原始项目的引用
                partition_key: originalItem.partition_key,
                sort_key: originalItem.sort_key
            },
            cached_at: new Date().toISOString()      // 缓存时间戳
        }
    }).promise();
}

/**
 * 获取CORS响应头
 * @returns CORS响应头对象
 */
function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',          // 允许所有来源
        'Access-Control-Allow-Credentials': true,    // 允许凭证
        'Content-Type': 'application/json'           // 内容类型
    };
}
