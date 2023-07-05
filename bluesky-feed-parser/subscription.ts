import {
  OutputSchema as RepoEvent,
  isCommit,
} from "./lexicon/types/com/atproto/sync/subscribeRepos";
import { FirehoseSubscriptionBase, getOpsByType } from "./util/subscription";
import awsCommunity from "./aws-community.json";
import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { cmd } from "../util/cmd";

const client = new RDSDataClient({});
const awsCommunityDids = Object.values(awsCommunity);
// swap keys and values of awsCommunity
const awsCommunityDidsToKeys = Object.fromEntries(
  Object.entries(awsCommunity).map((entry) => entry.reverse())
);

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return;
    const ops = await getOpsByType(evt);

    const postsToCreate = [];
    const postsToDelete = ops.posts.deletes.map((del) => del.uri);
    for (const post of ops.posts.creates) {
      // you can resolve a did using this... keeping it here for reference
      // const didResolver = new DidResolver();
      // const resolved = (await didResolver.resolveDidNoCheck(
      //   post.author
      // )) as any;
      // const user = (resolved.alsoKnownAs[0] || "").replace("at://", "");
      if (awsCommunityDids.includes(post.author)) {
        const user = awsCommunityDidsToKeys[post.author];
        console.log(`${user} posted ${post.record.text}`);
        postsToCreate.push({
          uri: post.uri,
          cid: post.cid,
          author: user,
          replyParent: post.record?.reply?.parent.uri ?? null,
          replyRoot: post.record?.reply?.root.uri ?? null,
          indexedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        });
      }
    }

    if (postsToDelete.length > 0) {
      const placeholders = postsToDelete.map(() => ":uri").join(", ");

      const deleteSql = `DELETE FROM post WHERE uri IN (${placeholders})`;

      const deleteParams = postsToDelete.map((uri) => ({
        name: "uri",
        value: { stringValue: uri },
      }));

      const deleteCmd = cmd(deleteSql, deleteParams);
      const deleted = await client.send(deleteCmd);
      // log how many rows were deleted if greater than 0
      if (
        deleted.numberOfRecordsUpdated &&
        deleted.numberOfRecordsUpdated > 0
      ) {
        console.log(`Deleted ${deleted.numberOfRecordsUpdated} posts`);
      }
    }

    if (postsToCreate.length > 0) {
      console.log(JSON.stringify({ postsToCreate }));
      const insertSql = `INSERT INTO post (uri, cid, author, replyParent, replyRoot, indexedAt) VALUES ${postsToCreate
        .map(
          () => "(:uri, :cid, :author, :replyParent, :replyRoot, :indexedAt)"
        )
        .join(", ")} ON DUPLICATE KEY UPDATE uri = uri`;

      const insertParams = postsToCreate.flatMap((post) => [
        { name: "uri", value: { stringValue: post.uri } },
        { name: "cid", value: { stringValue: post.cid } },
        { name: "author", value: { stringValue: post.author } },
        {
          name: "replyParent",
          value: post.replyParent
            ? { stringValue: post.replyParent }
            : { isNull: true },
        },
        {
          name: "replyRoot",
          value: post.replyRoot
            ? { stringValue: post.replyRoot }
            : { isNull: true },
        },
        { name: "indexedAt", value: { stringValue: post.indexedAt } },
      ]);

      const insertCmd = cmd(insertSql, insertParams);
      await client.send(insertCmd);
      console.log(`Created ${postsToCreate.length} posts`);
    }
  }
}
