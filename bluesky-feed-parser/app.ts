import { FirehoseSubscription } from "./subscription";

const run = async () => {
  console.log('Starting subscription...');
  const firehose = new FirehoseSubscription("wss://bsky.social")
  firehose.run(3000);
};

run();