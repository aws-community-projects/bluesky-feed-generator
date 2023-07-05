import type {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
} from "aws-lambda";
import {
  RDSDataClient,
} from "@aws-sdk/client-rds-data";
import { cmd } from "../../util/cmd";

const client = new RDSDataClient({});

export const handler = async (
  event: CloudFormationCustomResourceEvent
): Promise<CloudFormationCustomResourceResponse> => {
  if (event.RequestType === "Create") {
    await client.send(cmd(`select 1`));
    console.log("db-init: create tables");
    await client.send(
      cmd(
        `CREATE TABLE IF NOT EXISTS post (uri VARCHAR(255) NOT NULL, cid VARCHAR(255) NOT NULL, author VARCHAR(255) NOT NULL, replyParent VARCHAR(255), replyRoot VARCHAR(255), indexedAt DATETIME NOT NULL, PRIMARY KEY (uri));`
      )
    );
    console.log("created post table");
    await client.send(cmd(`CREATE TABLE IF NOT EXISTS sub_state (service VARCHAR(255) NOT NULL, cursor_value INT NOT NULL, PRIMARY KEY (service));`))
    console.log("created sub_state table");
  }

  return {
    Status: "SUCCESS",
    PhysicalResourceId: "db-init",
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
  };
};
