export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!token || !code || !state) {
    return new Response("Missing token, code, or state", { status: 400 });
  }

  const payload = JSON.stringify({ token, code, state })
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Hackers' Pub Auth</title>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </head>
    <body>
      <p>Processing authentication...</p>
      <script id="auth-payload" type="application/json">${payload}</script>
      <script>
        (async () => {
          try {
            const payloadNode = document.getElementById("auth-payload");
            if (!payloadNode || !payloadNode.textContent) {
              throw new Error("Missing auth payload");
            }
            const payload = JSON.parse(payloadNode.textContent);
            const response = await fetch('/api/auth/hackerspub/graphql-callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              credentials: 'include',
            });

            const data = await response.json();

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
