import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "~/components/LegalPage";
import content from "../../../TERMS_OF_SERVICE.ko.md?raw";

export const Route = createFileRoute("/legal/terms")({
  component: TermsOfServicePage,
  head: () => ({
    meta: [
      { title: "이용약관 — Moim" },
      { name: "description", content: "Moim 이용약관" },
      { property: "og:title", content: "이용약관 — Moim" },
      { property: "og:description", content: "Moim 이용약관" },
      { property: "og:type", content: "website" },
    ],
  }),
});

function TermsOfServicePage() {
  return <LegalPage content={content} />;
}
