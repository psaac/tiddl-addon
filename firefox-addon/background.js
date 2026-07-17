const BACKEND_URL = "http://127.0.0.1:8765/run-script";

browser.runtime.onMessage.addListener((message) => {
  if (message?.type !== "RUN_LOCAL_SCRIPT") {
    return undefined;
  }

  return fetch(BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pageUrl: message.pageUrl,
      mediaUrl: message.mediaUrl || "",
    }),
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          ok: false,
          error: data.error || `Backend returned ${response.status}.`,
        };
      }

      return data;
    })
    .catch((error) => ({
      ok: false,
      error: `Unable to reach local backend: ${error.message}`,
    }));
});
