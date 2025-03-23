/**
 * translateUtils.js - 翻译工具
 * 
 * 本模块提供了调用Amazon Translate服务的工具函数，用于文本翻译。
 * 同时实现了翻译缓存的逻辑，以避免重复翻译相同内容。
 */

const AWS = require('aws-sdk');
const translate = new AWS.Translate();
const dbUtils = require('./dbUtils');

/**
 * 翻译文本并缓存结果
 * @param {string} text - 要翻译的文本
 * @param {string} targetLanguage - 目标语言代码
 * @param {string} tableName - DynamoDB表名，用于存储缓存
 * @param {string} originalTextId - 原始文本标识符，用于缓存
 * @returns {Promise<Object>} - 翻译结果及其来源
 */
exports.translateText = async (text, targetLanguage, tableName, originalTextId) => {
  // 首先尝试从缓存中获取翻译
  const cacheResult = await dbUtils.getTranslationFromCache(tableName, originalTextId, targetLanguage);
  
  // 如果在缓存中找到翻译，直接返回
  if (cacheResult.Items && cacheResult.Items.length > 0) {
    return {
      translatedText: cacheResult.Items[0].translated_text,
      sourceLanguage: cacheResult.Items[0].source_language,
      source: 'cache'
    };
  }
  
  // 如果缓存中没有，调用Amazon Translate API
  const translateParams = {
    Text: text,
    SourceLanguageCode: 'auto',
    TargetLanguageCode: targetLanguage
  };
  
  const translateResult = await translate.translateText(translateParams).promise();
  
  // 将翻译结果保存到缓存
  const cacheItem = {
    original_text: originalTextId,
    language: targetLanguage,
    translated_text: translateResult.TranslatedText,
    source_language: translateResult.SourceLanguageCode,
    timestamp: new Date().toISOString()
  };
  
  await dbUtils.saveTranslationToCache(tableName, cacheItem);
  
  return {
    translatedText: translateResult.TranslatedText,
    sourceLanguage: translateResult.SourceLanguageCode,
    source: 'api'
  };
};

/**
 * 翻译多个文本字段并返回所有翻译结果
 * @param {Object} item - 包含多个字段的对象
 * @param {string[]} fields - 要翻译的字段名数组
 * @param {string} targetLanguage - 目标语言代码
 * @param {string} tableName - DynamoDB表名，用于存储缓存
 * @returns {Promise<Object>} - 包含所有字段翻译结果的对象
 */
exports.translateFields = async (item, fields, targetLanguage, tableName) => {
  const results = {};
  
  // 对每个字段并行进行翻译
  const translationPromises = fields.map(async (field) => {
    if (item[field] && typeof item[field] === 'string') {
      const originalTextId = `${item.partition_key}|${item.sort_key}|${field}`;
      const result = await exports.translateText(item[field], targetLanguage, tableName, originalTextId);
      results[field] = result.translatedText;
    }
  });
  
  // 等待所有翻译完成
  await Promise.all(translationPromises);
  
  return {
    originalItem: item,
    translatedFields: results,
    targetLanguage: targetLanguage
  };
};

/**
 * 获取支持的目标语言列表
 * @returns {Promise<Array>} - 支持的语言代码和名称列表
 */
exports.getSupportedLanguages = async () => {
  return translate.listLanguages().promise()
    .then(data => data.Languages);
}; 