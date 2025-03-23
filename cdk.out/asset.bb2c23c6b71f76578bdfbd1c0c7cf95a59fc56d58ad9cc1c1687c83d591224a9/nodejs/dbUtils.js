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
  const params = {
    TableName: tableName,
    IndexName: 'TranslationIndex',
    KeyConditionExpression: 'original_text = :text AND language = :lang',
    ExpressionAttributeValues: {
      ':text': originalText,
      ':lang': language
    }
  };
  
  return dynamoDB.query(params).promise();
};

/**
 * 保存翻译到缓存
 * @param {string} tableName - DynamoDB表名
 * @param {Object} cacheItem - 要缓存的翻译项目
 * @returns {Promise<Object>} - 保存操作的结果
 */
exports.saveTranslationToCache = async (tableName, cacheItem) => {
  return dynamoDB.put({
    TableName: tableName,
    Item: cacheItem
  }).promise();
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