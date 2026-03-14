export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <p className="text-sm text-muted-foreground py-8 text-center">{message}</p>
  );
}
