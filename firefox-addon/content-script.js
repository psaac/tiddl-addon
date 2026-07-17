(function () {
  const BUTTON_ID = "tiddl-local-runner-button";
  const BUTTON_CLASS = "tiddl-local-runner-button-list";
  const STATUS_ID = "tiddl-local-runner-status";

  mountButton();
  mountListButtons();
  observePlayer();

  function createButton(getMediaUrl) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", "Download with Python");
    button.setAttribute("title", "Download with Python");
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.29a1 1 0 1 1 1.4 1.41l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.41L11 12.59V4a1 1 0 0 1 1-1Zm-7 13a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z" fill="currentColor"></path>
      </svg>
    `;

    button.addEventListener("click", async () => {
      button.disabled = true;
      setStatus("Starting download...", false);

      const mediaUrl = getMediaUrl();
      if (!mediaUrl) {
        setStatus("Unable to find the track URL.", true);
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

    return button;
  }

  function mountButton() {
    if (document.getElementById(BUTTON_ID)) {
      return;
    }

    const playControl = findPlayControl();
    if (!playControl) {
      return;
    }

    const button = createButton(findCurrentMediaUrl);
    button.id = BUTTON_ID;

    const status = document.createElement("div");
    status.id = STATUS_ID;
    status.hidden = true;

    playControl.insertAdjacentElement("afterend", button);
    document.body.append(status);
  }

  function mountListButtons() {
    const mediaItems = document.querySelectorAll('[data-type="mediaItem"]');

    mediaItems.forEach((item) => {
      // Check if button already exists in this item
      if (item.querySelector(`.${BUTTON_CLASS}`)) {
        return;
      }

      // Find the _indexColumn and _titleColumn elements
      const indexColumn = item.querySelector('[class*="_indexColumn_"]');
      const titleColumn = item.querySelector('[class*="_titleColumn_"]');

      if (!indexColumn || !titleColumn) {
        return;
      }

      // Create button with a function to get the URL for this item
      const button = createButton(() => {
        const mediaLink = item.querySelector("a[href]");
        const href = mediaLink?.getAttribute("href");
        if (!href) {
          return null;
        }
        return new URL(href, window.location.origin).toString();
      });
      button.classList.add(BUTTON_CLASS);

      // Insert button after indexColumn and before titleColumn
      titleColumn.parentElement?.insertBefore(button, titleColumn);
    });
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
    const detailsRoot = document.querySelector(
      '[class^="_currentMediaItemDetails_"]',
    );
    const mediaLink = detailsRoot?.querySelector("a[href]");
    const href = mediaLink?.getAttribute("href");

    if (!href) {
      return null;
    }

    return new URL(href, window.location.origin).toString();
  }

  function observePlayer() {
    const observer = new MutationObserver(() => {
      if (!document.getElementById(BUTTON_ID)) {
        mountButton();
      }

      mountListButtons();
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
