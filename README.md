# User Management API

A serverless REST API built with AWS CDK, Amazon DynamoDB, Lambda, and API Gateway.

## 🚀 Features

### API Endpoints

- **POST /items** - Add a new item to the database
- **GET /items/{partition_key}** - Get all items with the specified partition key
  - Optional query string parameter: `filter` to filter results by description content
- **PUT /items/{partition_key}/{sort_key}** - Update an existing item
- **GET /items/{partition_key}/{sort_key}/translation?language=XX** - Get a translated version of an item's description
  - Required query string parameter: `language` (e.g., 'fr', 'es', 'de', etc.)
  - Translations are cached to reduce costs

### Data Model

Items in DynamoDB have the following structure:
- `partition_key` (String, required) - Primary partition key
- `sort_key` (String, required) - Primary sort key
- `description` (String, required) - Text field that can be translated
- `numeric_value` (Number, optional) - Example numeric field
- `is_active` (Boolean, optional) - Example boolean field
- `created_at` (String) - ISO timestamp of creation
- `updated_at` (String) - ISO timestamp of last update

## 🔧 Setup and Deployment

### Prerequisites

- Node.js and npm installed
- AWS CLI configured with appropriate credentials
- AWS CDK installed globally (`npm install -g aws-cdk`)

### Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Deploy the stack:
   ```
   cdk deploy
   ```

The deployment will output the API URL and other important information.

## 📝 Usage Examples

### Create an item

```bash
curl -X POST https://your-api-url/items \
  -H "Content-Type: application/json" \
  -d '{
    "partition_key": "user123",
    "sort_key": "profile",
    "description": "This is a sample user profile",
    "numeric_value": 42,
    "is_active": true
  }'
```

### Get items by partition key

```bash
curl -X GET https://your-api-url/items/user123
```

### Get filtered items

```bash
curl -X GET https://your-api-url/items/user123?filter=sample
```

### Update an item

```bash
curl -X PUT https://your-api-url/items/user123/profile \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated user profile description",
    "is_active": false
  }'
```

### Get translated description

```bash
curl -X GET https://your-api-url/items/user123/profile/translation?language=fr
```

## 🏗️ Architecture

- **API Gateway**: Handles HTTP requests
- **Lambda**: Processes requests and interacts with DynamoDB
- **DynamoDB**: Stores item data and cached translations
- **Amazon Translate**: Provides translation service

## 🌐 Future Enhancements

- API Key authentication for POST and PUT endpoints
- Custom domain name
- Additional endpoint features 
