export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session");
  const instance = url.searchParams.get("instance");

  if (!sessionId || !instance) {
    return new Response("Missing session or instance", { status: 400 });
  }

  // Properly escape JSON values
  const payload = JSON.stringify({ session: sessionId, instance })
  .replace(/</g, "\\u003c")
  .replace(/>/g, "\\u003e")
  .replace(/&/g, "\\u0026");

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
      <script id="miauth-payload" type="application/json">${payload}</script>
      <script>
        (async () => {
          try {
            const payloadNode = document.getElementById("miauth-payload");
            if (!payloadNode || !payloadNode.textContent) {
              throw new Error("Missing MiAuth payload");
            }
            const payload = JSON.parse(payloadNode.textContent);
            const response = await fetch('/api/auth/misskey/miauth-callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              credentials: 'include',
            });

            const data = await response.json();

            if (response.ok) {
              var dest = data.returnTo;
              window.location.href = (typeof dest === 'string' && dest.charAt(0) === '/' && dest.charAt(1) !== '/') ? dest : '/';
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