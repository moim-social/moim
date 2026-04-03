import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "~/components/LegalPage";
import content from "../../../REFUND_POLICY.ko.md?raw";

export const Route = createFileRoute("/legal/refund")({
  component: RefundPolicyPage,
  head: () => ({
    meta: [
      { title: "환불정책 — Moim" },
      { name: "description", content: "Moim 환불정책" },
      { property: "og:title", content: "환불정책 — Moim" },
      { property: "og:description", content: "Moim 환불정책" },
      { property: "og:type", content: "website" },
    ],
  }),
});

function RefundPolicyPage() {
  return <LegalPage content={content} />;
}
