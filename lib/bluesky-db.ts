import { CustomResource, Duration, RemovalPolicy } from "aws-cdk-lib";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { ServerlessCluster, Credentials, DatabaseClusterEngine } from "aws-cdk-lib/aws-rds";
import { Provider } from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { join } from "path";

export interface BlueskyDbProps {
  dbName: string;
  vpc: IVpc;
}

export class BlueskyDb extends Construct {
  db: ServerlessCluster;
  constructor(scope: Construct, id: string, props: BlueskyDbProps) {
    super(scope, id);

    const { dbName, vpc } = props;
    this.db = new ServerlessCluster(this, 'cluster', {
      clusterIdentifier: `bluesky`,
      credentials: Credentials.fromGeneratedSecret('admin'),
      defaultDatabaseName: dbName,
      engine: DatabaseClusterEngine.AURORA_MYSQL,
      removalPolicy: RemovalPolicy.DESTROY,
      enableDataApi: true,
      vpc,
    });

    const dbInitFn = new NodejsFunction(this, "dbInitFn", {
      functionName: "bluesky-db-init",
      entry: join(__dirname, "lambda/db-init.ts"),
      runtime: Runtime.NODEJS_18_X,
      timeout: Duration.minutes(15),
      tracing: Tracing.ACTIVE,
      environment: {
        DB_NAME: dbName,
        CLUSTER_ARN: this.db.clusterArn,
        SECRET_ARN: this.db.secret?.secretArn || '',
      },
    });
    new LogGroup(this, "db-init-log-group", {
      logGroupName: `/aws/lambda/${dbInitFn.functionName}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: RetentionDays.ONE_DAY,
    });
    this.db.grantDataApiAccess(dbInitFn);

    const initProvider = new Provider(this, `init-db-provider`, {
      onEventHandler: dbInitFn,
    });

    new CustomResource(this, `init-db-resource`, {
      serviceToken: initProvider.serviceToken,
    });
  }
}