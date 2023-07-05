#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BlueskyFeedGeneratorStack } from '../lib/bluesky-feed-generator-stack';

const app = new cdk.App();
new BlueskyFeedGeneratorStack(app, 'BlueskyFeedGeneratorStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  publishFeed: {
    handle: 'martz.codes',
    blueskySecretArn: "arn:aws:secretsmanager:us-east-1:359317520455:secret:bluesky-rQXJxQ",
    feeds: {
      "aws-community": {
        displayName: "AWS Community",
        description: "This is a test feed served from an AWS Lambda. It is a list of AWS Employees, AWS Heroes and AWS Community Builders",
      }
    },
  },
});