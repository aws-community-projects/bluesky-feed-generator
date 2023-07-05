import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { cmd } from "../../util/cmd";

const client = new RDSDataClient({});
export const handler = async (event: any) => {
  console.log(JSON.stringify(event));

  const limit = Number(event.queryStringParameters?.limit || 10);
  const feed = event.queryStringParameters?.feed || "at://did:plc:a62mzn6xxxxwktpdprw2lvnc/app.bsky.feed.generator/martzcodes-2";
  const feedSplit = feed.split("/");
  const feedShortName = feedSplit[feedSplit.length - 1];

  const res = await client.send(cmd(`select uri from post ORDER BY indexedAt DESC LIMIT ${limit}`));
  const rows = res.records?.map((row: any) => row?.[0]?.stringValue).filter((row) => !!row) || [];
  console.log(JSON.stringify({ res, rows, feedShortName }));

  if (rows.length && feedShortName && feedShortName === "aws-community") {
    return {
      statusCode: 200,
      body: JSON.stringify({
        // cursor: "",
        feed: rows.map((post: string) => ({ post })),
      }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      // cursor: "",
      feed: [
        {
          post: "at://did:plc:a62mzn6xxxxwktpdprw2lvnc/app.bsky.feed.post/3jzfvxjaeks2k",
        },
        {
          post: "at://did:plc:a62mzn6xxxxwktpdprw2lvnc/app.bsky.feed.post/3jzgo32n2x32s",
        },
        {
          post: "at://did:plc:a62mzn6xxxxwktpdprw2lvnc/app.bsky.feed.post/3jzgnvn5tc62g",
        },
      ],
    }),
  };
};
