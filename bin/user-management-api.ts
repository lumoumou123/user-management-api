#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { UserManagementApiStack } from '../lib/user-management-api-stack';

const app = new cdk.App();
new UserManagementApiStack(app, 'UserManagementApiStack');
