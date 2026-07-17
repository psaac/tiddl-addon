(function () {
  const BUTTON_ID = "tiddl-local-runner-button";
  const STATUS_ID = "tiddl-local-runner-status";

  mountButton();
  observePlayer();

  function mountButton() {
    if (document.getElementById(BUTTON_ID)) {
      return;
    }

    const playControl = findPlayControl();
    if (!playControl) {
      return;
    }

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.setAttribute("aria-label", "Download with Python");
    button.setAttribute("title", "Download with Python");
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.29a1 1 0 1 1 1.4 1.41l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.41L11 12.59V4a1 1 0 0 1 1-1Zm-7 13a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z" fill="currentColor"></path>
      </svg>
    `;

    const status = document.createElement("div");
    status.id = STATUS_ID;
    status.hidden = true;

    button.addEventListener("click", async () => {
      button.disabled = true;
      setStatus("Starting download...", false);

      const mediaUrl = findCurrentMediaUrl();
      if (!mediaUrl) {
        setStatus("Unable to find the current track URL.", true);
        button.disabled = false;
        return;
      }

      try {
        const response = await browser.runtime.sendMessage({
          type: "RUN_LOCAL_SCRIPT",
          pageUrl: window.location.href,
          mediaUrl,
        });

        if (!response?.ok) {
          setStatus(response?.error || "Unknown backend error.", true);
          return;
        }

        setStatus(response.message || "Python script executed.", false);
      } catch (error) {
        setStatus(`Extension error: ${error.message}`, true);
      } finally {
        button.disabled = false;
      }
    });

    playControl.insertAdjacentElement("afterend", button);
    document.body.append(status);
  }

  function findPlayControl() {
    const footerPlayer = document.querySelector("#footerPlayer");
    if (!footerPlayer) {
      return null;
    }

    const playButton = footerPlayer.querySelector('button[data-test="play"]');
    if (!playButton) {
      return null;
    }

    return playButton.parentElement;
  }

  function findCurrentMediaUrl() {
    const detailsRoot = document.querySelector('[class^="_currentMediaItemDetails_"]');
    const mediaLink = detailsRoot?.querySelector("a[href]");
    const href = mediaLink?.getAttribute("href");

    if (!href) {
      return null;
    }

    return new URL(href, window.location.origin).toString();
  }

  function observePlayer() {
    const observer = new MutationObserver(() => {
      if (document.getElementById(BUTTON_ID)) {
        return;
      }

      mountButton();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function setStatus(message, isError) {
    const status = document.getElementById(STATUS_ID);
    if (!status) {
      return;
    }

    status.hidden = false;
    status.textContent = message;
    status.dataset.state = isError ? "error" : "success";
  }
})();
