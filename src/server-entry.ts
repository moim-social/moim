import { createApp, fromWebHandler, toWebHandler } from "h3";
import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import { integrateFederation, onError } from "@fedify/h3";
import { federation } from "./server/fediverse/federation";

const startFetch = createStartHandler(defaultStreamHandler);

const app = createApp({ onError });
app.use(integrateFederation(federation, () => undefined));
app.use(
  fromWebHandler(async (request) => {
    return startFetch(request);
  }),
);

const handler = toWebHandler(app);

export default {
  async fetch(request: Request) {
    return handler(request);
  },
};
