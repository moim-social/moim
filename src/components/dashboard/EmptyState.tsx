export function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-muted-foreground py-8 text-center">{message}</p>
  );
}
