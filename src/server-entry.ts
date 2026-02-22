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
import { GET as searchUsers } from "./routes/groups/-search-users";
import { POST as resolveModerator } from "./routes/groups/-resolve-moderator";
import { POST as createGroup } from "./routes/groups/-create";

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

// Group API routes
app.use("/groups/search-users", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return searchUsers({ request });
}));

app.use("/groups/resolve-moderator", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return resolveModerator({ request });
}));

app.use("/groups/create", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return createGroup({ request });
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
