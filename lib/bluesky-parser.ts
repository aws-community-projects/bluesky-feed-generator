import { ISecurityGroup, IVpc, SubnetType } from "aws-cdk-lib/aws-ec2";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import {
  Cluster,
  FargateTaskDefinition,
  ContainerImage,
  FargateService,
  CpuArchitecture,
  AwsLogDriver,
} from "aws-cdk-lib/aws-ecs";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { ServerlessCluster } from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";
import { join } from "path";

export interface BlueskyParserProps {
  db: ServerlessCluster;
  dbName: string;
  securityGroup: ISecurityGroup;
  vpc: IVpc;
}

export class BlueskyParser extends Construct {
  constructor(scope: Construct, id: string, props: BlueskyParserProps) {
    super(scope, id);

    const { db, dbName, securityGroup, vpc } = props;
    const cluster = new Cluster(this, "bluesky-feed-generator-cluster", {
      vpc,
      enableFargateCapacityProviders: true,
    });

    const taskDefinition = new FargateTaskDefinition(
      this,
      "bluesky-feed-generator-task",
      {
        runtimePlatform: {
          cpuArchitecture: CpuArchitecture.ARM64,
        },
        memoryLimitMiB: 1024,
        cpu: 512,
      }
    );
    db.grantDataApiAccess(taskDefinition.taskRole);

    const logging = new AwsLogDriver({
      logRetention: RetentionDays.ONE_DAY,
      streamPrefix: "bluesky-feed-generator",
    });

    taskDefinition.addContainer("bluesky-feed-parser", {
      logging,
      image: ContainerImage.fromDockerImageAsset(
        new DockerImageAsset(this, "bluesky-feed-parser-img", {
          directory: join(__dirname, ".."),
          platform: Platform.LINUX_ARM64,
        })
      ),
      environment: {
        DB_NAME: dbName,
        CLUSTER_ARN: db.clusterArn,
        SECRET_ARN: db.secret?.secretArn || '',
      }
    });

    new FargateService(this, "bluesky-feed-generator", {
      cluster,
      taskDefinition,
      enableExecuteCommand: true,
      // fargate service needs to select subnets with the NAT in order to access AWS services
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [securityGroup]
    });
  }
}
