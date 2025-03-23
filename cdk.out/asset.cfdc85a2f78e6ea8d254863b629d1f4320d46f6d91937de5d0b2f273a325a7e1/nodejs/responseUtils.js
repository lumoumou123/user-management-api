/**
 * responseUtils.js - 响应工具
 * 
 * 本模块提供了创建一致性的API响应结构的工具函数，
 * 确保所有API端点返回格式一致的响应。
 */

/**
 * 创建成功响应
 * @param {number} statusCode - HTTP状态码
 * @param {Object|Array} data - 响应数据
 * @param {string} [message] - 可选的消息
 * @returns {Object} - 格式化的成功响应对象
 */
exports.success = (statusCode, data, message) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key'
    },
    body: JSON.stringify({
      success: true,
      message: message || getDefaultSuccessMessage(statusCode),
      data
    })
  };
};

/**
 * 创建错误响应
 * @param {number} statusCode - HTTP状态码
 * @param {string} message - 错误消息
 * @param {Error} [error] - 可选的错误对象
 * @returns {Object} - 格式化的错误响应对象
 */
exports.error = (statusCode, message, error) => {
  const response = {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key'
    },
    body: JSON.stringify({
      success: false,
      message
    })
  };
  
  // 在开发环境中包含错误堆栈
  if (process.env.NODE_ENV !== 'production' && error) {
    const errorDetails = JSON.parse(response.body);
    errorDetails.error = error.message;
    errorDetails.stack = error.stack;
    response.body = JSON.stringify(errorDetails);
  }
  
  return response;
};

/**
 * 获取默认成功消息
 * @param {number} statusCode - HTTP状态码
 * @returns {string} - 基于状态码的默认消息
 */
function getDefaultSuccessMessage(statusCode) {
  switch (statusCode) {
    case 200:
      return '请求成功';
    case 201:
      return '资源创建成功';
    case 204:
      return '删除成功';
    default:
      return '操作成功';
  }
}

/**
 * 处理预检请求(CORS OPTIONS)
 * @returns {Object} - CORS预检响应
 */
exports.handleOptions = () => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
      'Access-Control-Max-Age': '86400'
    },
    body: ''
  };
};

/**
 * 验证API密钥存在
 * @param {Object} event - API Gateway事件对象
 * @param {string[]} requiredMethods - 需要验证API密钥的HTTP方法数组
 * @returns {Object|null} - 如果验证失败返回错误响应，否则返回null
 */
exports.validateApiKey = (event, requiredMethods) => {
  if (
    requiredMethods.includes(event.httpMethod) && 
    (!event.headers || !event.headers['x-api-key'])
  ) {
    return exports.error(401, '缺少必需的API密钥');
  }
  return null;
}; 