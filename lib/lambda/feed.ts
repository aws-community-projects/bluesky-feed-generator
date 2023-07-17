import AtpAgent from "@atproto/api";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import awsCommunity from "./aws-community.json";

const awsCommunityDids = Object.values(awsCommunity);

const client = new SecretsManagerClient({});

const buildFeed = async ({
  agent,
  prevPostIds,
  limit,
  prevCursor,
}: {
  agent: AtpAgent;
  prevPostIds: string[];
  limit: number;
  prevCursor?: string;
}): Promise<string[]> => {
  const postIds = [...prevPostIds];
  const res = await agent.api.app.bsky.feed.getTimeline({
    limit: 100,
    cursor: prevCursor,
  });
  const { data } = res;
  const { cursor, feed } = data;
  for (const feedItem of feed) {
    const authorId = feedItem.post.author.did;
    if (awsCommunityDids.includes(authorId)) {
      postIds.push(feedItem.post.uri);
      if (postIds.length >= limit) {
        break;
      }
    }
  };
  if (postIds.length < limit && cursor) {
    return buildFeed({ agent, prevPostIds: postIds, limit, prevCursor: cursor });
  }

  return postIds;
};

export const handler = async (event: any) => {
  console.log(JSON.stringify(event));

  try {
    const limit = Number(event.queryStringParameters?.limit || 10);
    const feed =
      event.queryStringParameters?.feed ||
      "at://did:plc:a62mzn6xxxxwktpdprw2lvnc/app.bsky.feed.generator/martzcodes-2";
    const feedSplit = feed.split("/");
    const feedShortName = feedSplit[feedSplit.length - 1];

    let rows: any[] = [];
    const handle = `${process.env.HANDLE}`;
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
        rows = await buildFeed({ agent, prevPostIds: [], limit });
      } catch (e) {
        console.log(e);
      }
    }

    if (rows.length && feedShortName && feedShortName === "aws-community") {
      return {
        statusCode: 200,
        body: JSON.stringify({
          // cursor: "",
          feed: rows.map((post: string) => ({ post })),
        }),
      };
    }
  } catch (e) {
    console.log(e);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      // cursor: "",
      feed: [
        {
          post: "at://did:plc:a62mzn6xxxxwktpdprw2lvnc/app.bsky.feed.post/3jzubebnszy2z",
        },
      ],
    }),
  };
};
