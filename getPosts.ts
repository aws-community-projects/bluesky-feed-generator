import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import AtpAgent from "@atproto/api";

const agent = new AtpAgent({ service: "https://bsky.social" });

const handle = "martz.codes";
const password = process.env.BLUESKY_APP_PASSWORD || "";

const hydrateCommunity = async () => {
  await agent.login({ identifier: handle, password });
  // const awsCommunity = JSON.parse(
  //   readFileSync(join(__dirname, "bluesky-feed-parser/aws-community.json"), "utf-8")
  // );
  const res = await agent.api.app.bsky.feed.getTimeline({
    limit: 100,
    cursor: "1689528337722::bafyreieofluo2gr6627qewenotyakjjsmk2zvvkawtexbmate6dour2dly"
  });
  console.log(JSON.stringify({ res }, null, 2));

  // const actors = Object.keys(awsCommunity);
  // for (const actor of actors) {
  //   if (!awsCommunity[actor]) {
  //     try {
  //       const res = await agent.api.app.bsky.actor.getProfile({ actor });
  //       awsCommunity[actor] = res?.data?.did || "";
  //     } catch (e: any) {
  //       console.log(`Error hydrating ${actor}: ${e.message}`);
  //     }
  //   }
  // }
  // // writeFileSync
  // writeFileSync(join(__dirname, "bluesky-feed-parser/aws-community.json"), JSON.stringify(awsCommunity, null, 2), "utf-8");
};
hydrateCommunity();
