export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = body?.url;

    if (!url) {
      return new Response(
        JSON.stringify({ error: "Missing url in request body" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const origin = new URL(req.url).origin;

    // 1) Try cache first
    try {
      const cacheUrl = `${origin}/cache?url=${encodeURIComponent(url)}`;
      const cached = await fetch(cacheUrl, {
        method: "GET",
        signal: req.signal,
      });
      if (cached.ok) {
        const json = await cached.json();
        if (json?.menu) {
          return new Response(JSON.stringify({ menu: json.menu }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    } catch (err) {
      console.warn("Proxy: cache check failed", err);
    }

    // 2) If not found in cache, call the heavy scraper route
    const menuUrl = `${origin}/menu`;
    const menuRes = await fetch(menuUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: req.signal,
    });

    const menuJson = await menuRes.json().catch(() => null);

    // 3) Store in cache, if valid (at least try to)
    if (menuRes.ok && menuJson?.menu && menuJson.menu.menu_items.length) {
      (async () => {
        try {
          const cachePostUrl = `${origin}/cache`;
          await fetch(cachePostUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url, response: menuJson.menu }),
          });
        } catch (e) {
          console.warn("Proxy: failed to store menu in cache", e);
        }
      })();
    }

    // 4) Return whatever /menu route returned
    return new Response(
      JSON.stringify(menuJson ?? { error: "No response from menu route" }),
      {
        status: menuRes.status || 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Proxy error:", err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
