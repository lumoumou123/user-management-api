/**
 * translateUtils.js - 翻译工具
 * 
 * 本模块提供了调用Amazon Translate服务的工具函数，用于文本翻译。
 * 同时实现了翻译缓存的逻辑，以避免重复翻译相同内容。
 */

const AWS = require('aws-sdk');
// 更详细配置Translate客户端，添加区域设置
const translate = new AWS.Translate({
  region: process.env.AWS_REGION || 'eu-west-1',
  apiVersion: '2017-07-01'
});
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
  try {
    console.log('准备翻译文本:', { text, targetLanguage, originalTextId });
    
    // 首先尝试从缓存中获取翻译
    const cacheResult = await dbUtils.getTranslationFromCache(tableName, originalTextId, targetLanguage);
    console.log('缓存查询结果:', JSON.stringify(cacheResult));
    
    // 如果在缓存中找到翻译，直接返回
    if (cacheResult.Items && cacheResult.Items.length > 0) {
      console.log('从缓存中找到翻译');
      return {
        translatedText: cacheResult.Items[0].translated_text,
        sourceLanguage: cacheResult.Items[0].source_language,
        source: 'cache'
      };
    }
    
    console.log('缓存中未找到翻译，调用Amazon Translate API');
    
    // 如果缓存中没有，调用Amazon Translate API
    const translateParams = {
      Text: text,
      SourceLanguageCode: 'auto',
      TargetLanguageCode: targetLanguage
    };
    
    console.log('翻译参数:', JSON.stringify(translateParams));
    
    // 添加更多错误处理
    try {
      const translateResult = await translate.translateText(translateParams).promise();
      console.log('翻译成功:', JSON.stringify(translateResult));
      
      // 将翻译结果保存到缓存
      const cacheItem = {
        original_text: originalTextId,
        language: targetLanguage,
        translated_text: translateResult.TranslatedText,
        source_language: translateResult.SourceLanguageCode,
        timestamp: new Date().toISOString()
      };
      
      console.log('准备缓存翻译结果:', JSON.stringify(cacheItem));
      await dbUtils.saveTranslationToCache(tableName, cacheItem);
      
      return {
        translatedText: translateResult.TranslatedText,
        sourceLanguage: translateResult.SourceLanguageCode,
        source: 'api'
      };
    } catch (translateError) {
      console.error('Amazon Translate API调用失败:', translateError);
      console.error('错误名称:', translateError.name);
      console.error('错误消息:', translateError.message);
      console.error('错误代码:', translateError.code);
      throw translateError;
    }
  } catch (error) {
    console.error('翻译过程中发生错误:', error);
    throw error;
  }
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
  try {
    console.log('准备翻译多个字段:', { fields, targetLanguage });
    console.log('原始项目:', JSON.stringify(item));
    
    const results = {};
    
    // 对每个字段并行进行翻译
    const translationPromises = fields.map(async (field) => {
      if (item[field] && typeof item[field] === 'string') {
        console.log(`准备翻译字段 ${field}:`, item[field]);
        const originalTextId = `${item.partition_key}|${item.sort_key}|${field}`;
        const result = await exports.translateText(item[field], targetLanguage, tableName, originalTextId);
        results[field] = result.translatedText;
      }
    });
    
    // 等待所有翻译完成
    await Promise.all(translationPromises);
    console.log('所有翻译完成:', JSON.stringify(results));
    
    return {
      originalItem: item,
      translatedFields: results,
      targetLanguage: targetLanguage
    };
  } catch (error) {
    console.error('翻译字段过程中发生错误:', error);
    throw error;
  }
};

/**
 * 获取支持的目标语言列表
 * @returns {Promise<Array>} - 支持的语言代码和名称列表
 */
exports.getSupportedLanguages = async () => {
  try {
    console.log('获取支持的语言列表');
    const result = await translate.listLanguages().promise();
    console.log('支持的语言列表:', JSON.stringify(result));
    return result.Languages;
  } catch (error) {
    console.error('获取支持语言列表失败:', error);
    throw error;
  }
}; 