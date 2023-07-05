import { CustomResource, Duration, RemovalPolicy } from "aws-cdk-lib";
import {
  EndpointType,
  IntegrationOptions,
  LambdaIntegration,
  MockIntegration,
  PassthroughBehavior,
  RestApi,
  SecurityPolicy,
} from "aws-cdk-lib/aws-apigateway";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { ServerlessCluster } from "aws-cdk-lib/aws-rds";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { ApiGateway } from "aws-cdk-lib/aws-route53-targets";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Provider } from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { join } from "path";

export interface BlueskyPublishFeedProps {
  handle: string;
  blueskySecretArn: string;
  feeds: Record<
    string,
    {
      displayName: string;
      description: string;
    }
  >;
}

export interface BlueskyFeedProps {
  db: ServerlessCluster;
  dbName: string;
  domainName: string;
  publishFeed: BlueskyPublishFeedProps;
}

export class BlueskyFeed extends Construct {
  constructor(scope: Construct, id: string, props: BlueskyFeedProps) {
    super(scope, id);

    const { db, dbName, domainName: zoneDomain } = props;
    const domainName = `feed.${zoneDomain}`;
    const hostedzone = HostedZone.fromLookup(this, "hostedzone", {
      domainName: zoneDomain,
    });
    const certificate = new Certificate(this, "certificate", {
      domainName,
      validation: CertificateValidation.fromDns(hostedzone),
    });

    const api = new RestApi(this, "RestApi", {
      defaultMethodOptions: {
        methodResponses: [{ statusCode: "200" }],
      },
      deployOptions: {
        tracingEnabled: true,
        metricsEnabled: true,
        dataTraceEnabled: true,
      },
      endpointConfiguration: {
        types: [EndpointType.REGIONAL],
      },
    });

    const didOptions: IntegrationOptions = {
      passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
      requestTemplates: {
        "application/json": `{"statusCode" : 200}`,
      },
      integrationResponses: [
        {
          statusCode: "200",
          responseTemplates: {
            "application/json": JSON.stringify({
              "@context": ["https://www.w3.org/ns/did/v1"],
              id: `did:web:${domainName}`,
              service: [
                {
                  id: "#bsky_fg",
                  type: "BskyFeedGenerator",
                  serviceEndpoint: `https://${domainName}`,
                },
              ],
            }),
          },
        },
      ],
    };

    const feedFn = new NodejsFunction(this, "feed", {
      functionName: "bluesky-feed",
      entry: join(__dirname, "lambda/feed.ts"),
      runtime: Runtime.NODEJS_18_X,
      timeout: Duration.seconds(30),
      tracing: Tracing.ACTIVE,
      environment: {
        DB_NAME: dbName,
        CLUSTER_ARN: db.clusterArn,
        SECRET_ARN: db.secret?.secretArn || "",
      },
    });
    db.grantDataApiAccess(feedFn);
    new LogGroup(this, "feed-log-group", {
      logGroupName: `/aws/lambda/${feedFn.functionName}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: RetentionDays.ONE_DAY,
    });
    const feedIntegration = new LambdaIntegration(feedFn, {
      integrationResponses: [
        {
          statusCode: "200",
        },
      ],
      passthroughBehavior: PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": '{ "statusCode": 200 }',
      },
    });
    api.root
      .addResource("xrpc")
      .addResource("app.bsky.feed.getFeedSkeleton")
      .addMethod("GET", feedIntegration);

    const didIntegration = new MockIntegration(didOptions);
    const didResource = api.root
      .addResource(".well-known")
      .addResource("did.json");
    didResource.addMethod("GET", didIntegration, {
      methodResponses: [
        {
          statusCode: "200",
        },
      ],
    });

    api.addDomainName(`Domain`, {
      domainName,
      certificate,
      securityPolicy: SecurityPolicy.TLS_1_2,
    });
    new ARecord(scope, `ARecord`, {
      zone: hostedzone,
      recordName: domainName,
      target: RecordTarget.fromAlias(new ApiGateway(api)),
    });


    const publishSecret = Secret.fromSecretCompleteArn(this, "publish-secret", props.publishFeed.blueskySecretArn);
    const publishFeedFn = new NodejsFunction(this, "publish-feed", {
      functionName: "bluesky-publish-feed",
      entry: join(__dirname, "lambda/publish-feed.ts"),
      runtime: Runtime.NODEJS_18_X,
      timeout: Duration.seconds(30),
      tracing: Tracing.ACTIVE,
      environment: {
        HANDLE: props.publishFeed.handle,
        SECRET_ARN: props.publishFeed.blueskySecretArn,
        FEEDGEN_HOSTNAME: domainName,
        FEEDS: JSON.stringify(props.publishFeed.feeds),
      },
    });
    publishSecret.grantRead(publishFeedFn);
    new LogGroup(this, "publish-feed-log-group", {
      logGroupName: `/aws/lambda/${publishFeedFn.functionName}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: RetentionDays.ONE_DAY,
    });

    const publishProvider = new Provider(this, `publish-feed-provider`, {
      onEventHandler: publishFeedFn,
    });

    new CustomResource(this, `publish-feed-resource`, {
      serviceToken: publishProvider.serviceToken,
      properties: {
        Version: `${Date.now()}`,
      },
    });
  }
}
