import type { ReactNode } from "react";
import { RemoteInteractionButton } from "~/components/RemoteInteractionButton";

export function RemoteDiscussionDialog({
  apUrl,
  triggerLabel = "Discuss on your instance",
  variant = "button",
  className,
}: {
  apUrl: string;
  triggerLabel?: ReactNode;
  variant?: "button" | "link" | "ghost";
  className?: string;
}) {
  return (
    <RemoteInteractionButton
      kind="discussion"
      target={apUrl}
      className={className}
      triggerVariant={variant}
      triggerLabel={triggerLabel}
    />
  );
}
