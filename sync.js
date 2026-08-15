export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  const scriptUrl = process.env.NIRAMAYA_SCRIPT_URL;
  const accessCode = process.env.NIRAMAYA_ACCESS_CODE;

  if (!scriptUrl || !accessCode) {
    return response.status(500).json({
      ok: false,
      error: "Vercel environment variables are not configured."
    });
  }

  try {
    if (request.method === "GET") {
      const action = request.query.action || "ping";
      if (action === "ping") {
        return response.status(200).json({
          ok: true,
          message: "Niramaya Vercel sync endpoint is running."
        });
      }
      if (action === "read") {
        const result = await readFromAppsScript(scriptUrl, accessCode);
        return response.status(200).json(result);
      }
      return response.status(400).json({ ok: false, error: "Unsupported action." });
    }

    if (request.method !== "POST") {
      return response.status(405).json({ ok: false, error: "Method not allowed." });
    }

    const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
    if (body.action !== "sync") {
      return response.status(400).json({ ok: false, error: "Unsupported action." });
    }

    await writeToAppsScript(scriptUrl, accessCode, body.entries || []);
    const result = await readFromAppsScript(scriptUrl, accessCode);
    return response.status(200).json(result);
  } catch (error) {
    return response.status(500).json({
      ok: false,
      error: error.message || "Sync failed."
    });
  }
}

async function writeToAppsScript(scriptUrl, accessCode, entries) {
  const payload = JSON.stringify({
    action: "sync",
    accessCode,
    entries
  });
  const form = new URLSearchParams();
  form.set("payload", payload);

  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: form.toString()
  });
  const result = await parseUpstreamJson(response, "Google Apps Script write");
  if (!result.ok) {
    throw new Error(result.error || "Google Sheet write failed.");
  }
}

async function readFromAppsScript(scriptUrl, accessCode) {
  const url = new URL(scriptUrl);
  url.searchParams.set("action", "read");
  url.searchParams.set("accessCode", accessCode);
  url.searchParams.set("t", Date.now().toString());

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json"
    }
  });
  const result = await parseUpstreamJson(response, "Google Apps Script read");
  if (!result.ok) {
    throw new Error(result.error || "Google Sheet read failed.");
  }
  return result;
}

async function parseUpstreamJson(response, label) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    const hint = text.trim().startsWith("<!DOCTYPE")
      ? "It returned an HTML page. Check that NIRAMAYA_SCRIPT_URL is the Apps Script Web App URL ending in /exec, and that the deployment access is Anyone."
      : "It did not return valid JSON.";
    throw new Error(`${label} failed. ${hint}`);
  }
}
