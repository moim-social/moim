import { StartServer } from "@tanstack/react-start";
import { router } from "./router";

export default function Server() {
  return <StartServer router={router} />;
}
