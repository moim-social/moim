import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "~/components/LegalPage";
import content from "../../../PRIVACY_POLICY.ko.md?raw";

export const Route = createFileRoute("/legal/privacy")({
  component: PrivacyPolicyPage,
  head: () => ({
    meta: [
      { title: "개인정보처리방침 — Moim" },
      { name: "description", content: "Moim 개인정보처리방침" },
      { property: "og:title", content: "개인정보처리방침 — Moim" },
      { property: "og:description", content: "Moim 개인정보처리방침" },
      { property: "og:type", content: "website" },
    ],
  }),
});

function PrivacyPolicyPage() {
  return <LegalPage content={content} />;
}
