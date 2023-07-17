import { Construct } from "constructs";
import { Stack, StackProps } from "aws-cdk-lib";
import { BlueskyFeed, BlueskyPublishFeedProps } from "./bluesky-feed";

export interface BlueskyFeedGeneratorStackProps extends StackProps {
  publishFeed: BlueskyPublishFeedProps;
}

export class BlueskyFeedGeneratorStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: BlueskyFeedGeneratorStackProps
  ) {
    super(scope, id, props);

    const { publishFeed } = props;

    const domainName = "martz.codes";

    new BlueskyFeed(this, "bluesky-feed", {
      domainName,
      publishFeed,
    });
  }
}
