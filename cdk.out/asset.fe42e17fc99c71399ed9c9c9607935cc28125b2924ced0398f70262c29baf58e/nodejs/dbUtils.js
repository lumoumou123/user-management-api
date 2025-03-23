/**
 * dbUtils.js - 数据库操作工具
 * 
 * 本模块提供了对DynamoDB进行操作的工具函数，可以被不同的Lambda函数重用。
 * 这些函数包含了常用的CRUD操作和一些辅助功能。
 */

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

/**
 * 创建新项目到DynamoDB
 * @param {string} tableName - DynamoDB表名
 * @param {Object} item - 要创建的项目数据
 * @returns {Promise<Object>} - 创建操作的结果
 */
exports.createItem = async (tableName, item) => {
  const params = {
    TableName: tableName,
    Item: item,
    ConditionExpression: 'attribute_not_exists(partition_key) AND attribute_not_exists(sort_key)'
  };
  
  return dynamoDB.put(params).promise();
};

/**
 * 获取单个项目
 * @param {string} tableName - DynamoDB表名
 * @param {string} partitionKey - 分区键值
 * @param {string} sortKey - 排序键值
 * @returns {Promise<Object>} - 获取操作的结果
 */
exports.getItem = async (tableName, partitionKey, sortKey) => {
  const params = {
    TableName: tableName,
    Key: {
      partition_key: partitionKey,
      sort_key: sortKey
    }
  };
  
  return dynamoDB.get(params).promise();
};

/**
 * 查询项目列表
 * @param {string} tableName - DynamoDB表名
 * @param {string} partitionKey - 分区键值
 * @param {string} [filterExpression] - 可选的过滤表达式
 * @returns {Promise<Object>} - 查询操作的结果
 */
exports.queryItems = async (tableName, partitionKey, filterExpression) => {
  let params = {
    TableName: tableName,
    KeyConditionExpression: 'partition_key = :pk',
    ExpressionAttributeValues: {
      ':pk': partitionKey
    }
  };
  
  if (filterExpression) {
    params.FilterExpression = 'contains(description, :filter)';
    params.ExpressionAttributeValues[':filter'] = filterExpression;
  }
  
  return dynamoDB.query(params).promise();
};

/**
 * 更新项目
 * @param {string} tableName - DynamoDB表名 
 * @param {string} partitionKey - 分区键值
 * @param {string} sortKey - 排序键值
 * @param {Object} updates - 更新的字段和值
 * @returns {Promise<Object>} - 更新操作的结果
 */
exports.updateItem = async (tableName, partitionKey, sortKey, updates) => {
  // 移除不可更新的键
  delete updates.partition_key;
  delete updates.sort_key;
  
  let updateExpression = 'SET';
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  
  Object.entries(updates).forEach(([key, value], index) => {
    const attributeName = `#attr${index}`;
    const attributeValue = `:val${index}`;
    
    updateExpression += `${index === 0 ? ' ' : ', '}${attributeName} = ${attributeValue}`;
    expressionAttributeNames[attributeName] = key;
    expressionAttributeValues[attributeValue] = value;
  });
  
  if (Object.keys(expressionAttributeValues).length === 0) {
    throw new Error('没有提供要更新的字段');
  }
  
  const params = {
    TableName: tableName,
    Key: {
      partition_key: partitionKey,
      sort_key: sortKey
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
    ConditionExpression: 'attribute_exists(partition_key) AND attribute_exists(sort_key)'
  };
  
  return dynamoDB.update(params).promise();
};

/**
 * 从缓存中查询翻译
 * @param {string} tableName - DynamoDB表名
 * @param {string} originalText - 原始文本
 * @param {string} language - 目标语言代码
 * @returns {Promise<Object>} - 查询操作的结果
 */
exports.getTranslationFromCache = async (tableName, originalText, language) => {
  try {
    console.log('查询翻译缓存:', { originalText, language, tableName });
    
    // 先尝试直接使用缓存键获取
    const cacheKey = `TRANSLATION#${originalText}#${language}`;
    console.log('尝试直接获取缓存项:', cacheKey);
    
    try {
      const directResult = await dynamoDB.get({
        TableName: tableName,
        Key: {
          partition_key: cacheKey,
          sort_key: 'TRANSLATION'
        }
      }).promise();
      
      if (directResult.Item) {
        console.log('直接获取到缓存项:', JSON.stringify(directResult));
        return { Items: [directResult.Item] };
      }
    } catch (directError) {
      console.error('直接获取缓存项失败:', directError);
      // 继续尝试使用索引查询
    }
    
    // 使用GSI查询
    console.log('尝试使用GSI查询缓存:', { originalText, language });
    const params = {
      TableName: tableName,
      IndexName: 'TranslationIndex',
      KeyConditionExpression: 'original_text = :text AND language = :lang',
      ExpressionAttributeValues: {
        ':text': originalText,
        ':lang': language
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    console.log('查询结果:', JSON.stringify(result));
    return result;
  } catch (error) {
    console.error('查询翻译缓存失败:', error);
    console.error('错误详情:', JSON.stringify(error, null, 2));
    // 返回空结果而不是抛出错误，以允许翻译流程继续
    return { Items: [] };
  }
};

/**
 * 保存翻译到缓存
 * @param {string} tableName - DynamoDB表名
 * @param {Object} cacheItem - 要缓存的翻译项目
 * @returns {Promise<Object>} - 保存操作的结果
 */
exports.saveTranslationToCache = async (tableName, cacheItem) => {
  try {
    console.log('保存翻译到缓存:', JSON.stringify(cacheItem));
    
    // 构建缓存键
    const cacheKey = `TRANSLATION#${cacheItem.original_text}#${cacheItem.language}`;
    
    // 创建一个标准格式的缓存项
    const standardizedCacheItem = {
      partition_key: cacheKey,
      sort_key: 'TRANSLATION',
      original_text: cacheItem.original_text,
      language: cacheItem.language,
      translated_text: cacheItem.translated_text,
      source_language: cacheItem.source_language,
      timestamp: cacheItem.timestamp || new Date().toISOString()
    };
    
    console.log('标准化的缓存项:', JSON.stringify(standardizedCacheItem));
    
    const result = await dynamoDB.put({
      TableName: tableName,
      Item: standardizedCacheItem
    }).promise();
    
    console.log('缓存保存结果:', JSON.stringify(result));
    return result;
  } catch (error) {
    console.error('保存翻译缓存失败:', error);
    console.error('错误详情:', JSON.stringify(error, null, 2));
    // 返回基本结果而不是抛出错误，翻译过程可以继续
    return { success: false, error: error.message };
  }
};

/**
 * 删除项目
 * @param {string} tableName - DynamoDB表名
 * @param {string} partitionKey - 分区键值
 * @param {string} sortKey - 排序键值
 * @returns {Promise<Object>} - 删除操作的结果
 */
exports.deleteItem = async (tableName, partitionKey, sortKey) => {
  const params = {
    TableName: tableName,
    Key: {
      partition_key: partitionKey,
      sort_key: sortKey
    },
    ReturnValues: 'ALL_OLD'
  };
  
  return dynamoDB.delete(params).promise();
}; 