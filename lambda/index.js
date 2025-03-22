const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const translate = new AWS.Translate();

// 表名从环境变量中获取
const TABLE_NAME = process.env.TABLE_NAME;

/**
 * Lambda函数入口点
 */
exports.handler = async (event) => {
  console.log('收到的事件:', JSON.stringify(event, null, 2));
  
  try {
    const httpMethod = event.httpMethod;
    const path = event.path;
    
    // 验证API密钥(仅针对POST和PUT请求)
    if ((httpMethod === 'POST' || httpMethod === 'PUT') && !event.headers['x-api-key']) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: '缺少API密钥' })
      };
    }
    
    // 根据HTTP方法和路径处理请求
    if (httpMethod === 'POST' && path === '/items') {
      return await createItem(event);
    } else if (httpMethod === 'GET' && event.pathParameters && event.pathParameters.partition_key) {
      if (event.pathParameters.sort_key && event.resource.includes('translation')) {
        return await getTranslation(event);
      } else if (event.pathParameters.sort_key) {
        return await getItem(event);
      } else {
        return await getItems(event);
      }
    } else if (httpMethod === 'PUT' && event.pathParameters && event.pathParameters.partition_key && event.pathParameters.sort_key) {
      return await updateItem(event);
    }
    
    // 如果没有匹配的路由，返回404
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: '未找到路由' })
    };
  } catch (error) {
    console.error('错误:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: '内部服务器错误', error: error.message })
    };
  }
};

/**
 * 创建新项目
 */
async function createItem(event) {
  const item = JSON.parse(event.body);
  
  // 验证必需字段
  if (!item.partition_key || !item.sort_key) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: '缺少必填字段 partition_key 或 sort_key' })
    };
  }
  
  const params = {
    TableName: TABLE_NAME,
    Item: item,
    ConditionExpression: 'attribute_not_exists(partition_key) AND attribute_not_exists(sort_key)'
  };
  
  try {
    await dynamoDB.put(params).promise();
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: '项目创建成功', item })
    };
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: '项目已存在' })
      };
    }
    throw error;
  }
}

/**
 * 获取单个项目
 */
async function getItem(event) {
  const partition_key = event.pathParameters.partition_key;
  const sort_key = event.pathParameters.sort_key;
  
  const params = {
    TableName: TABLE_NAME,
    Key: {
      partition_key,
      sort_key
    }
  };
  
  const result = await dynamoDB.get(params).promise();
  
  if (!result.Item) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: '未找到项目' })
    };
  }
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(result.Item)
  };
}

/**
 * 获取项目列表，支持可选的过滤器
 */
async function getItems(event) {
  const partition_key = event.pathParameters.partition_key;
  const filterExpression = event.queryStringParameters?.filter;
  
  let params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'partition_key = :pk',
    ExpressionAttributeValues: {
      ':pk': partition_key
    }
  };
  
  if (filterExpression) {
    params.FilterExpression = 'contains(description, :filter)';
    params.ExpressionAttributeValues[':filter'] = filterExpression;
  }
  
  const result = await dynamoDB.query(params).promise();
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(result.Items)
  };
}

/**
 * 更新现有项目
 */
async function updateItem(event) {
  const partition_key = event.pathParameters.partition_key;
  const sort_key = event.pathParameters.sort_key;
  const updates = JSON.parse(event.body);
  
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
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: '没有提供要更新的字段' })
    };
  }
  
  const params = {
    TableName: TABLE_NAME,
    Key: {
      partition_key,
      sort_key
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
    ConditionExpression: 'attribute_exists(partition_key) AND attribute_exists(sort_key)'
  };
  
  try {
    const result = await dynamoDB.update(params).promise();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result.Attributes)
    };
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: '未找到项目' })
      };
    }
    throw error;
  }
}

/**
 * 获取文本翻译
 */
async function getTranslation(event) {
  const partition_key = event.pathParameters.partition_key;
  const sort_key = event.pathParameters.sort_key;
  const language = event.queryStringParameters?.language;
  
  if (!language) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: '缺少必需的language查询参数' })
    };
  }
  
  // 首先尝试从缓存中获取翻译
  const cacheParams = {
    TableName: TABLE_NAME,
    IndexName: 'TranslationIndex',
    KeyConditionExpression: 'original_text = :text AND language = :lang',
    ExpressionAttributeValues: {
      ':text': partition_key + '|' + sort_key,
      ':lang': language
    }
  };
  
  const cacheResult = await dynamoDB.query(cacheParams).promise();
  
  // 如果在缓存中找到翻译，直接返回
  if (cacheResult.Items && cacheResult.Items.length > 0) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        translated_text: cacheResult.Items[0].translated_text,
        source: 'cache'
      })
    };
  }
  
  // 否则，获取原始项目
  const itemParams = {
    TableName: TABLE_NAME,
    Key: {
      partition_key,
      sort_key
    }
  };
  
  const itemResult = await dynamoDB.get(itemParams).promise();
  
  if (!itemResult.Item) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: '未找到项目' })
    };
  }
  
  // 使用Amazon Translate服务翻译描述字段
  const textToTranslate = itemResult.Item.description || '';
  
  if (!textToTranslate) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: '项目没有可翻译的描述' })
    };
  }
  
  const translateParams = {
    Text: textToTranslate,
    SourceLanguageCode: 'auto',
    TargetLanguageCode: language
  };
  
  const translateResult = await translate.translateText(translateParams).promise();
  
  // 将翻译结果保存到缓存
  const cacheItem = {
    original_text: partition_key + '|' + sort_key,
    language,
    translated_text: translateResult.TranslatedText,
    source_language: translateResult.SourceLanguageCode,
    timestamp: new Date().toISOString()
  };
  
  await dynamoDB.put({
    TableName: TABLE_NAME,
    Item: cacheItem
  }).promise();
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ 
      translated_text: translateResult.TranslatedText,
      source: 'api',
      source_language: translateResult.SourceLanguageCode
    })
  };
} 