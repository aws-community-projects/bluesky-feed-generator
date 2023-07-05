import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import { BlueskyFeed, BlueskyPublishFeedProps } from './bluesky-feed';
import { BlueskyDb } from './bluesky-db';
import { BlueskyParser } from './bluesky-parser';

export interface BlueskyFeedGeneratorStackProps extends StackProps {
  publishFeed: BlueskyPublishFeedProps;
}

export class BlueskyFeedGeneratorStack extends Stack {
  constructor(scope: Construct, id: string, props: BlueskyFeedGeneratorStackProps) {
    super(scope, id, props);

    const { publishFeed } = props;

    const vpc = new Vpc(this, "vpc");
    const securityGroup = new SecurityGroup(this, "security-group", {
      vpc,
      allowAllOutbound: true,
    });

    const dbName = 'bluesky';
    const { db } = new BlueskyDb(this, 'bluesky-db', {
      dbName,
      vpc,
    });

    const domainName = 'martz.codes';

    new BlueskyParser(this, 'bluesky-parser', {
      db,
      dbName,
      securityGroup,
      vpc,
    });

    new BlueskyFeed(this, 'bluesky-feed', {
      db,
      dbName,
      domainName,
      publishFeed,
    });
  }
}
