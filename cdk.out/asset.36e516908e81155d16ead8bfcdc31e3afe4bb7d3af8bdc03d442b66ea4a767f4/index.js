/**
 * Lambda处理函数 - 用户管理API
 * 
 * 该Lambda函数处理用户管理API的所有请求，包括:
 * - 创建、获取、更新和删除项目
 * - 文本翻译和缓存
 */

// 从共享层导入工具模块
const dbUtils = require('/opt/nodejs/dbUtils');
const translateUtils = require('/opt/nodejs/translateUtils');
const responseUtils = require('/opt/nodejs/responseUtils');

// 表名从环境变量中获取
const TABLE_NAME = process.env.TABLE_NAME;

// 需要API密钥的HTTP方法
const METHODS_REQUIRING_API_KEY = ['POST', 'PUT'];

/**
 * Lambda函数入口点
 * @param {Object} event - API Gateway事件对象
 * @returns {Object} - API Gateway响应对象
 */
exports.handler = async (event) => {
  console.log('收到的事件:', JSON.stringify(event, null, 2));
  
  try {
    const httpMethod = event.httpMethod;
    const path = event.path;
    
    // 处理CORS预检请求
    if (httpMethod === 'OPTIONS') {
      return responseUtils.handleOptions();
    }
    
    // 验证API密钥(对于需要验证的方法)
    const apiKeyError = responseUtils.validateApiKey(event, METHODS_REQUIRING_API_KEY);
    if (apiKeyError) {
      return apiKeyError;
    }
    
    // 根据HTTP方法和路径处理请求
    if (httpMethod === 'POST' && path.endsWith('/items')) {
      return await createItem(event);
    } else if (httpMethod === 'GET' && event.pathParameters && event.pathParameters.partition_key) {
      if (event.pathParameters.sort_key && path.includes('translation')) {
        return await getTranslation(event);
      } else if (event.pathParameters.sort_key) {
        return await getItem(event);
      } else {
        return await getItems(event);
      }
    } else if (httpMethod === 'PUT' && event.pathParameters && event.pathParameters.partition_key && event.pathParameters.sort_key) {
      return await updateItem(event);
    } else if (httpMethod === 'DELETE' && event.pathParameters && event.pathParameters.partition_key && event.pathParameters.sort_key) {
      return await deleteItem(event);
    }
    
    // 如果没有匹配的路由，返回404
    return responseUtils.error(404, '未找到路由');
  } catch (error) {
    console.error('错误:', error);
    return responseUtils.error(500, '内部服务器错误', error);
  }
};

/**
 * 创建新项目
 * @param {Object} event - API Gateway事件对象
 * @returns {Object} - API Gateway响应对象
 */
async function createItem(event) {
  const item = JSON.parse(event.body);
  
  // 验证必需字段
  if (!item.partition_key || !item.sort_key) {
    return responseUtils.error(400, '缺少必填字段 partition_key 或 sort_key');
  }
  
  try {
    await dbUtils.createItem(TABLE_NAME, item);
    return responseUtils.success(201, item, '项目创建成功');
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      return responseUtils.error(409, '项目已存在');
    }
    throw error;
  }
}

/**
 * 获取单个项目
 * @param {Object} event - API Gateway事件对象
 * @returns {Object} - API Gateway响应对象
 */
async function getItem(event) {
  const partition_key = event.pathParameters.partition_key;
  const sort_key = event.pathParameters.sort_key;
  
  const result = await dbUtils.getItem(TABLE_NAME, partition_key, sort_key);
  
  if (!result.Item) {
    return responseUtils.error(404, '未找到项目');
  }
  
  return responseUtils.success(200, result.Item);
}

/**
 * 获取项目列表，支持可选的过滤器
 * @param {Object} event - API Gateway事件对象
 * @returns {Object} - API Gateway响应对象
 */
async function getItems(event) {
  const partition_key = event.pathParameters.partition_key;
  const filterExpression = event.queryStringParameters?.filter;
  
  const result = await dbUtils.queryItems(TABLE_NAME, partition_key, filterExpression);
  
  return responseUtils.success(200, result.Items);
}

/**
 * 更新现有项目
 * @param {Object} event - API Gateway事件对象
 * @returns {Object} - API Gateway响应对象
 */
async function updateItem(event) {
  const partition_key = event.pathParameters.partition_key;
  const sort_key = event.pathParameters.sort_key;
  const updates = JSON.parse(event.body);
  
  try {
    const result = await dbUtils.updateItem(TABLE_NAME, partition_key, sort_key, updates);
    return responseUtils.success(200, result.Attributes);
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      return responseUtils.error(404, '未找到项目');
    } else if (error.message === '没有提供要更新的字段') {
      return responseUtils.error(400, error.message);
    }
    throw error;
  }
}

/**
 * 删除项目
 * @param {Object} event - API Gateway事件对象
 * @returns {Object} - API Gateway响应对象
 */
async function deleteItem(event) {
  const partition_key = event.pathParameters.partition_key;
  const sort_key = event.pathParameters.sort_key;
  
  try {
    const result = await dbUtils.deleteItem(TABLE_NAME, partition_key, sort_key);
    
    if (!result.Attributes) {
      return responseUtils.error(404, '未找到项目');
    }
    
    return responseUtils.success(200, result.Attributes, '项目删除成功');
  } catch (error) {
    throw error;
  }
}

/**
 * 获取文本翻译
 * @param {Object} event - API Gateway事件对象
 * @returns {Object} - API Gateway响应对象
 */
async function getTranslation(event) {
  const partition_key = event.pathParameters.partition_key;
  const sort_key = event.pathParameters.sort_key;
  const language = event.queryStringParameters?.language;
  
  if (!language) {
    return responseUtils.error(400, '缺少必需的language查询参数');
  }
  
  // 获取原始项目
  const itemResult = await dbUtils.getItem(TABLE_NAME, partition_key, sort_key);
  
  if (!itemResult.Item) {
    return responseUtils.error(404, '未找到项目');
  }
  
  // 确定要翻译的字段
  const fieldsToTranslate = ['description', 'title'].filter(field => 
    itemResult.Item[field] && typeof itemResult.Item[field] === 'string'
  );
  
  if (fieldsToTranslate.length === 0) {
    return responseUtils.error(400, '项目没有可翻译的文本字段');
  }
  
  try {
    // 翻译多个字段
    const translationResult = await translateUtils.translateFields(
      itemResult.Item, 
      fieldsToTranslate, 
      language, 
      TABLE_NAME
    );
    
    return responseUtils.success(200, translationResult);
  } catch (error) {
    console.error('翻译错误:', error);
    console.error('错误名称:', error.name);
    console.error('错误消息:', error.message);
    console.error('错误堆栈:', error.stack);
    console.error('详细错误对象:', JSON.stringify(error, null, 2));
    return responseUtils.error(500, '翻译服务错误', error);
  }
} 