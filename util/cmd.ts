import { ExecuteStatementCommand } from "@aws-sdk/client-rds-data";

const { CLUSTER_ARN, DB_NAME, SECRET_ARN } = process.env;

export const cmd = (sql: string, parameters?: any[]) =>
  new ExecuteStatementCommand({
    resourceArn: CLUSTER_ARN,
    secretArn: SECRET_ARN,
    database: DB_NAME,
    sql,
    parameters,
  });
