import worker from "../.open-next/worker.js";
import { DOQueueHandler } from "@opennextjs/cloudflare/durable-objects/queue";

export { DOQueueHandler };

export default {
  fetch: worker.fetch.bind(worker),
  async scheduled(_event, env, ctx) {
    const request = new Request("https://ghost-ticker.internal/api/cron/ingest", {
      headers: { authorization: `Bearer ${env.CRON_SECRET ?? ""}` },
    });
    ctx.waitUntil(worker.fetch(request, env, ctx));
  },
};
