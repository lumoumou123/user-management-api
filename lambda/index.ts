import { APIGatewayEvent, Context } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME!;

export async function handler(event: APIGatewayEvent, context: Context) {
    const httpMethod = event.httpMethod;
    const pathParameters = event.pathParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};

    if (httpMethod === 'POST') return createItem(body);
    if (httpMethod === 'GET' && pathParameters.partition_key) return getItem(pathParameters.partition_key);
    if (httpMethod === 'PUT' && pathParameters.partition_key && pathParameters.sort_key) return updateItem(pathParameters, body);
    if (httpMethod === 'GET' && pathParameters.partition_key && pathParameters.sort_key && event.queryStringParameters?.language) {
        return getTranslation(pathParameters, event.queryStringParameters.language);
    }

    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid request' }) };
}

async function createItem(data: any) {
    const item = {
        partition_key: data.partition_key,
        sort_key: data.sort_key,
        description: data.description,
    };

    await dynamodb.put({ TableName: TABLE_NAME, Item: item }).promise();
    return { statusCode: 201, body: JSON.stringify({ message: 'Item created' }) };
}

async function getItem(partition_key: string) {
    const response = await dynamodb.get({ TableName: TABLE_NAME, Key: { partition_key } }).promise();
    return response.Item
        ? { statusCode: 200, body: JSON.stringify(response.Item) }
        : { statusCode: 404, body: JSON.stringify({ message: 'Item not found' }) };
}

async function updateItem(keys: any, data: any) {
    await dynamodb.update({
        TableName: TABLE_NAME,
        Key: { partition_key: keys.partition_key, sort_key: keys.sort_key },
        UpdateExpression: 'SET description = :d',
        ExpressionAttributeValues: { ':d': data.description },
    }).promise();

    return { statusCode: 200, body: JSON.stringify({ message: 'Item updated' }) };
}

async function getTranslation(keys: any, language: string) {
    const response = await dynamodb.get({ TableName: TABLE_NAME, Key: { partition_key: keys.partition_key, sort_key: keys.sort_key } }).promise();
    const item = response.Item;

    if (!item) return { statusCode: 404, body: JSON.stringify({ message: 'Item not found' }) };

    const translate = new AWS.Translate();
    const translatedText = await translate.translateText({
        Text: item.description,
        SourceLanguageCode: 'en',
        TargetLanguageCode: language,
    }).promise();

    return { statusCode: 200, body: JSON.stringify({ translatedText: translatedText.TranslatedText }) };
}
