const BACKEND_URL = "http://127.0.0.1:8765/run-script";
const BACKEND_STREAM_URL = "http://127.0.0.1:8765/run-script-stream";

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "RUN_LOCAL_SCRIPT") {
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
  }

  if (message?.type === "RUN_LOCAL_SCRIPT_STREAM") {
    const tabId = sender.tab?.id;

    // Start streaming in background — return immediately
    (async () => {
      try {
        const response = await fetch(BACKEND_STREAM_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageUrl: message.pageUrl,
            mediaUrl: message.mediaUrl || "",
          }),
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE: split on double newline
          const parts = buffer.split("\n\n");
          buffer = parts.pop(); // Keep incomplete last chunk

          for (const part of parts) {
            for (const line of part.split("\n")) {
              if (line.startsWith("data: ")) {
                try {
                  const event = JSON.parse(line.slice(6));
                  if (tabId != null) {
                    browser.tabs.sendMessage(tabId, {
                      type: "DOWNLOAD_PROGRESS",
                      event,
                    });
                  }
                } catch {}
              }
            }
          }
        }
      } catch (error) {
        if (tabId != null) {
          browser.tabs.sendMessage(tabId, {
            type: "DOWNLOAD_PROGRESS",
            event: {
              type: "error",
              error: `Unable to reach local backend: ${error.message}`,
            },
          });
        }
      }
    })();

    return Promise.resolve({ ok: true, started: true });
  }

  return undefined;
});
