# User Management API System

This is a user management API system based on AWS serverless architecture, supporting multi-language translation functionality.

## System Architecture

The system is built on AWS serverless architecture, including the following components:

- **API Gateway**: Provides RESTful API interfaces
- **Lambda Function**: Processes requests and executes business logic
- **DynamoDB**: Stores user data and translation cache
- **Amazon Translate**: Provides text translation functionality
- **Amazon Comprehend**: Automatically detects text language (when using auto language detection)

## Features

- Complete CRUD operations: Create, Read, Update, and Delete user data
- API key protection: Ensures only authorized requests can access the API
- Multi-language translation: Supports translating text into multiple languages
- Translation caching: Translated text is cached, improving performance and reducing redundant API calls
- Error handling: Comprehensive error logging and error handling mechanisms

## Deployment Instructions

### Prerequisites

- Node.js (>= 14.x) installed
- AWS CLI and credentials configured
- AWS CDK installed: `npm install -g aws-cdk`

### Deployment Steps

1. Clone the repository:
   ```
   git clone [repository address]
   cd user-management-api
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Compile TypeScript:
   ```
   npm run build
   ```

4. Deploy AWS resources:
   ```
   cdk deploy --all
   ```

5. After deployment is complete, you will receive the API Gateway endpoint URL and API key.

## API Documentation

### Create Item

Create a new data item.

- **URL**: `/items`
- **Method**: POST
- **Request Headers**:
  - `x-api-key`: [Your API key]
  - `Content-Type`: application/json
- **Request Body**:
  ```json
  {
    "partition_key": "UserID",
    "sort_key": "ItemID",
    "title": "Title",
    "description": "Description"
  }
  ```
- **Response**: 201 Created

### Get Item

Retrieve a specific item.

- **URL**: `/items/{partition_key}/{sort_key}`
- **Method**: GET
- **Request Headers**:
  - `x-api-key`: [Your API key]
- **Response**: 200 OK

### Get Translation

Retrieve a translated version of an item.

- **URL**: `/items/{partition_key}/{sort_key}/translation?language={language_code}`
- **Method**: GET
- **Request Headers**:
  - `x-api-key`: [Your API key]
- **Query Parameters**:
  - `language`: Target language code (e.g., 'en' for English, 'zh' for Chinese)
- **Response**: 200 OK

### Update Item

Update an existing item.

- **URL**: `/items/{partition_key}/{sort_key}`
- **Method**: PUT
- **Request Headers**:
  - `x-api-key`: [Your API key]
  - `Content-Type`: application/json
- **Request Body**:
  ```json
  {
    "title": "Updated Title",
    "description": "Updated Description"
  }
  ```
- **Response**: 200 OK

### Delete Item

Delete a specific item.

- **URL**: `/items/{partition_key}/{sort_key}`
- **Method**: DELETE
- **Request Headers**:
  - `x-api-key`: [Your API key]
- **Response**: 204 No Content

## Usage Examples

### Create New Item

```bash
curl -X POST https://your-api-address/prod/items \
  -H "x-api-key: Your-API-Key" \
  -H "Content-Type: application/json" \
  -d '{
    "partition_key": "user123",
    "sort_key": "post1",
    "title": "This is a test title",
    "description": "This is a Chinese text that needs translation, describing the content and purpose of this test project."
  }'
```

### Get Item

```bash
curl -X GET https://your-api-address/prod/items/user123/post1 \
  -H "x-api-key: Your-API-Key"
```

### Get Item Translation

```bash
curl -X GET "https://your-api-address/prod/items/user123/post1/translation?language=en" \
  -H "x-api-key: Your-API-Key"
```

### Update Item

```bash
curl -X PUT https://your-api-address/prod/items/user123/post1 \
  -H "x-api-key: Your-API-Key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "description": "This is the updated description content, modified from the original text to test the update functionality."
  }'
```

### Delete Item

```bash
curl -X DELETE https://your-api-address/prod/items/user123/post1 \
  -H "x-api-key: Your-API-Key"
```

## Project Structure

```
user-management-api/
├── bin/                      # CDK application entry
├── lib/                      # CDK stack definitions
│   ├── api-stack.ts          # API Gateway stack
│   ├── database-stack.ts     # DynamoDB stack
│   └── lambda-stack.ts       # Lambda function stack
├── lambda/                   # Lambda function source code
│   └── index.js              # Main function entry
├── lambda-layers/            # Lambda layers
│   └── common/
│       └── nodejs/
│           ├── dbUtils.js    # Database operation utilities
│           └── translateUtils.js # Translation utilities
├── test/                     # Test code
├── cdk.json                  # CDK configuration
└── package.json              # Project dependencies
```

### Main Files and Method Descriptions

#### bin/user-management-api.ts
- `main()` - Entry point of the CDK application, instantiates and deploys all stacks

#### lib/api-stack.ts
- `constructor()` - Creates API Gateway resources, configures routes and integration methods
- `createApiGateway()` - Creates REST API and resources
- `createApiKey()` - Generates API key and usage plan
- `addRoutes()` - Adds all API routes and methods

#### lib/database-stack.ts
- `constructor()` - Creates DynamoDB table and GSI indexes
- `createItemsTable()` - Configures and creates the main items table
- `createCacheGSI()` - Creates a global secondary index for translation caching

#### lib/lambda-stack.ts
- `constructor()` - Creates Lambda functions and layers
- `createLambdaLayer()` - Creates Lambda layer for shared code
- `createItemFunction()` - Creates Lambda function for handling items
- `configurePermissions()` - Configures IAM permissions for Lambda functions

#### lambda/index.js
- `handler(event, context)` - Main Lambda handler function, routes different API events
- `handleGetItem(event)` - Handles GET requests to retrieve a single item
- `handleGetItems(event)` - Handles GET requests to retrieve multiple items (based on partition_key)
- `handleFilteredItems(event)` - Handles GET requests with query string
- `handlePostItem(event)` - Handles POST requests to create a new item
- `handlePutItem(event)` - Handles PUT requests to update an item
- `handleDeleteItem(event)` - Handles DELETE requests to delete an item
- `handleTranslation(event)` - Handles translation requests
- `validateApiKey(event)` - Validates API key (for POST and PUT requests)

#### lambda-layers/common/nodejs/dbUtils.js
- `getItem(partitionKey, sortKey)` - Gets a single item
- `queryItems(partitionKey)` - Queries multiple items based on partition key
- `queryItemsWithFilter(partitionKey, filterExp, expValues)` - Queries items with a filter
- `putItem(item)` - Creates a new item
- `updateItem(partitionKey, sortKey, updateExp, expValues)` - Updates an existing item
- `deleteItem(partitionKey, sortKey)` - Deletes an item
- `getTranslation(originalText, targetLanguage)` - Gets a translation from cache
- `saveTranslation(originalText, targetLanguage, translatedText)` - Saves a translation to cache

#### lambda-layers/common/nodejs/translateUtils.js
- `translateText(text, targetLanguage)` - Translates text using Amazon Translate
- `detectLanguage(text)` - Detects text language using Amazon Comprehend
- `formatTranslatedResponse(originalItem, translatedFields)` - Formats the translation response
- `translateItem(item, targetLanguage)` - Translates all relevant fields of an item
- `getCachedTranslation(text, targetLanguage)` - Checks for cached translations
- `cacheTranslation(text, targetLanguage, translatedText)` - Caches translation results

#### test/user-management-api.test.ts
- `testApiStack()` - Tests API stack creation
- `testDatabaseStack()` - Tests database stack creation
- `testLambdaStack()` - Tests Lambda stack creation and configuration

## Troubleshooting

### Common Errors

1. **Translation Service Error**:
   - Ensure Lambda role has correct IAM permissions: `translate:TranslateText` and `comprehend:DetectDominantLanguage`
   - Check if the target language code is valid (e.g., 'en', 'zh', etc.)

2. **DynamoDB Query Error**:
   - Check if the database table has been created
   - Confirm that the GSI (Global Secondary Index) is configured correctly
   - Note that "language" is a reserved keyword in DynamoDB, expression attribute names should be used in queries

3. **API Authorization Issues**:
   - Ensure the correct API key is being used
   - Check if the API key is valid and has not expired

For further assistance, check CloudWatch logs for detailed error information.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Assignment Requirements

**Objective**: Demonstrate your understanding of the serverless services available on the AWS platform by designing and developing a skeleton REST API for a context of your choice (e.g. FYP). Your submission must use the CDK framework to provision the AWS resources the API requires.

**Completion date**: March 24, 2025

**Weighting**: 30%

### Submission Requirements

Submit a text file called assignment1.txt to the link on Moodle. The file should contain:
- The URL of the GitHub repository
- The URL of the YouTube video demonstrating the API

**Notes**:
- The repo README is the documentation of the work you have carried out and must be complete and accurate.
- Your repo's Git log must have a clear, understandable and coherent history of the work on this assignment. The commit message must summarize the work performed (What task were you working on?) at each stage.

### Detailed Specification

The REST API (App API) should meet the following endpoint requirements:
1. A POST request to add an item to your database table.
2. A parameterized GET request to return a collection of table items, where the path parameter represents the table partition key value.
3. An extension of the above GET request to include a query string option for filtering the items.
4. A PUT request to update an item.
5. A GET request that returns an item with its main text attribute translated to a specified language, e.g. GET /things/{partition_key}/{sort_key}/translation?language=fr (French).

### DynamoDB Table Design

The app requires one table with a composite primary key. The non-key attributes should include a mix of scalar data types (numeric, string, boolean) and one string-based attribute whose content is suitable for the translation feature (e.g. a description attribute).

### Authorization

The POST and PUT endpoints should be protected. These requests should include an API key in the x-api-key HTTP request header. The CDK stack creates the key resource(s) at deployment time.

### Amazon Translate

"Amazon Translate is a Neural Machine Translation (MT) service for translating text between supported languages ... enabling developers to build applications requiring support across multiple languages. The service can be used via an API, enabling either real-time or batch translation of text from the source language to the target language." - AWS Docs

To reduce costs, repeated requests to the Translate service for the same text translations should be avoided. Instead, the App API should persist translations to DynamoDB and use these to respond to repeat requests, i.e. a form of caching. Ideally, these should be stored in the same table as the source data.

## Grading Criteria

### Good (40-50%):
- **Functionality** - Support for basic GET (no query string) and POST endpoints (no authorization required).
- **Database** - Table design; Seeding.

### Very Good (50-65%):
- **Functionality** - Extended GET (query string parameter), PUT and POST (no authentication), and translation endpoints.

### Excellent (65-85%):
- **Authorization** - Protected POST and PUT endpoints.
- **Performance** - Persist translations to avoid repeat translation costs.

### Outstanding (85%+):
- **Design** - Custom construct.
- **Infrastructure** - Lambda layers or Multi-stack app.

## Development Strategy

This project adopts an incremental approach to development. Each stage involves the addition of infrastructure (CDK stack code) and backend functionality (Lambda functions). This approach should be evident in the repository log.
