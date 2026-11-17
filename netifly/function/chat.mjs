const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed. Use POST." });
  }

  const apiKey = process.env.DIFY_API_KEY;
  if (!apiKey) {
    return json(500, {
      error: "Server is missing DIFY_API_KEY. Add it in Netlify > Site configuration > Environment variables, then redeploy.",
    });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Request body must be valid JSON." });
  }

  const query = typeof payload.query === "string" ? payload.query.trim() : "";
  if (!query) {
    return json(400, { error: "Missing 'query' in request body." });
  }
  if (query.length > 2000) {
    return json(400, { error: "Message is too long. Keep it under 2000 characters." });
  }

  const baseUrl = (process.env.DIFY_BASE_URL || "https://dify.ai").replace(/\/+$/, "");

  try {
    const difyRes = await fetch(`${baseUrl}/chat-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {},
        query,
        response_mode: "blocking",
        conversation_id: payload.conversation_id || "",
        user: payload.user || "corvit-student",
      }),
    });

    const text = await difyRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }

    if (!difyRes.ok) {
      return json(difyRes.status, {
        error: data.message || data.error || "Dify returned an error.",
        code: data.code || null,
      });
    }

    return json(200, {
      answer: data.answer || "",
      conversation_id: data.conversation_id || payload.conversation_id || "",
      message_id: data.message_id || null,
    });
  } catch (err) {
    return json(502, {
      error: "Could not reach the Dify service. Check DIFY_BASE_URL and try again.",
      detail: String(err && err.message ? err.message : err),
    });
  }
};
