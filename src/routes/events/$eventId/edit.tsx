import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/events/$eventId/edit")({
  component: EditEventRedirect,
});

function EditEventRedirect() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();

  useEffect(() => {
    navigate({
      to: "/events/$eventId/dashboard",
      params: { eventId },
      replace: true,
    });
  }, [eventId, navigate]);

  return <p className="text-muted-foreground p-6">Redirecting...</p>;
}
