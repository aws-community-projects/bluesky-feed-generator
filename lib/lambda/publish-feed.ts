import AtpAgent from "@atproto/api";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import type {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
} from "aws-lambda";

const client = new SecretsManagerClient({});

export const handler = async (
  event: CloudFormationCustomResourceEvent
): Promise<CloudFormationCustomResourceResponse> => {
  const handle = `${process.env.HANDLE}`;
  const feedGenDid = `did:web:${process.env.FEEDGEN_HOSTNAME}`;
  const feeds = JSON.parse(process.env.FEEDS || "{}") as Record<
    string,
    {
      displayName: string;
      description: string;
    }
  >;
  if (process.env.SECRET_ARN) {
    try {
      // get secret from secrets manager
      const secret = await client.send(
        new GetSecretValueCommand({
          SecretId: process.env.SECRET_ARN,
        })
      );
      const secretString = secret.SecretString || "";
      const secretJson = JSON.parse(secretString);
      const password = secretJson.password;
      const agent = new AtpAgent({ service: "https://bsky.social" });
      await agent.login({ identifier: handle, password });
      const recordNames = Object.keys(feeds);
      for (const recordName of recordNames) {
        const { displayName, description } = feeds[recordName];
        const putRecord = {
          repo: agent.session?.did ?? "",
          collection: "app.bsky.feed.generator",
          rkey: recordName,
          record: {
            did: feedGenDid,
            displayName: displayName,
            description: description,
            createdAt: new Date().toISOString(),
          },
        };
        const putRecordRes = await agent.api.com.atproto.repo.putRecord(putRecord);
        console.log(JSON.stringify({ putRecord, putRecordRes }, null, 2))
      }
    } catch (e) {
      console.log(e);
    }
  }

  return {
    Status: "SUCCESS",
    PhysicalResourceId: "publish-feed",
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
  };
};
