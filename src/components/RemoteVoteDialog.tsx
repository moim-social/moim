import { RemoteInteractionButton } from "~/components/RemoteInteractionButton";

export function RemoteVoteDialog({
  apUrl,
  className,
}: {
  apUrl: string;
  className?: string;
}) {
  return (
    <RemoteInteractionButton
      kind="vote"
      target={apUrl}
      className={className}
      triggerVariant="split"
    />
  );
}
