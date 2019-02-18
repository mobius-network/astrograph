import * as Sentry from "@sentry/node";
import { Cursor, Worker } from "./ingest";
import init from "./init";
import logger from "./util/logger";
import { DEBUG_LEDGER, INGEST_INTERVAL } from "./util/secrets";

init();

Cursor.build(DEBUG_LEDGER).then(cursor => {
  logger.info(
    `Staring ingest every ${INGEST_INTERVAL} ms. from ${
      DEBUG_LEDGER === -1 ? "first ledger" : DEBUG_LEDGER || "lastest ledger"
    }`
  );

  // indicates that we're waiting for the new ledger
  // to appear, so no need to log about it on every tick
  let waitNewLedgers = false;

  const tick = async () => {
    const worker = new Worker(cursor);
    worker
      .run()
      .then(done => {
        if (done) {
          logger.info(`Ledger ${cursor.current}: done.`);
          waitNewLedgers = false;
          tick();
        } else {
          if (!waitNewLedgers) {
            logger.info(`No new ledger, waiting...`);
            waitNewLedgers = true;
          }
          setTimeout(tick, INGEST_INTERVAL);
        }
      })
      .catch(e => {
        logger.error(e);
        if (e.message.includes("Please retry again, server is not ready to accept requests")) {
          setTimeout(tick, 200);
          return;
        }

        Sentry.captureException(e);
      });
  };

  tick();
});
