import { env } from "~/server/env";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session");
  const instance = url.searchParams.get("instance");

  if (!sessionId || !instance) {
    return new Response("Missing session or instance", { status: 400 });
  }

  // Properly escape JSON values
  const payload = JSON.stringify({ session: sessionId, instance });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Miauth Callback</title>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </head>
    <body>
      <p>Processing authentication...</p>
      <script>
        (async () => {
          try {
            const payload = ${payload};
            console.log('Sending payload:', payload);
            
            const response = await fetch('/api/auth/misskey/miauth-callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              credentials: 'include',
            });

            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);

            if (response.ok) {
              window.location.href = '/';
            } else {
              window.location.href = '/?error=' + (data.error || 'auth_failed');
            }
          } catch (error) {
            console.error('Error:', error);
            window.location.href = '/?error=server_error';
          }
        })();
      </script>
    </body>
    </html>
  `;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};