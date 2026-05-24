import type { ReactNode } from "react";
import { RemoteInteractionButton } from "~/components/RemoteInteractionButton";

export function RemoteFollowDialog({
  actorHandle,
  className,
  children,
}: {
  actorHandle: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <RemoteInteractionButton
      kind="follow"
      target={actorHandle}
      className={className}
      trigger={children}
      triggerVariant="split"
    />
  );
}
