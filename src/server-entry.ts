import { createApp, defineEventHandler, fromWebHandler, toWebHandler, toWebRequest } from "h3";
import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import { integrateFederation, onError } from "@fedify/h3";
import { federation } from "./server/fediverse/federation";
import { POST as requestOtp } from "./routes/auth/-request-otp";
import { POST as verifyOtp } from "./routes/auth/-verify-otp";
import { GET as getMe } from "./routes/auth/-me";
import { POST as signout } from "./routes/auth/-signout";

const startFetch = createStartHandler(defaultStreamHandler);

const app = createApp({ onError });
app.use(integrateFederation(federation, () => undefined));

// Auth API routes (pathless route files, registered explicitly via h3)
app.use("/auth/request-otp", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return requestOtp({ request });
}));

app.use("/auth/verify-otp", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return verifyOtp({ request });
}));

app.use("/auth/me", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return getMe({ request });
}));

app.use("/auth/signout", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return signout({ request });
}));

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
