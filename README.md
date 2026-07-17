# Firefox addon + local Python backend

This project contains:

- a minimal Firefox extension that adds a button to a target page
- a local Python backend called via HTTP when the button is clicked

## Setup

Install tiddl ([Github](https://github.com/oskvr37/tiddl/tree/main)):

```bash
cd backend
uv sync
uv tool install --python python3.13 tiddl==3.4.4
```

Optionally create config file (config.toml) in ~/.tiddl to configure download settings

## Structure

- `firefox-addon/` : Firefox extension
- `backend/main.py` : local Python HTTP server

## Starting the Python backend

From the project root:

```bash
uv run backend/main.py
```

The server listens on `http://127.0.0.1:8765` and exposes `POST /run-script`.

## Installing the extension in Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click on `Load Temporary Add-on`
3. Select `firefox-addon/manifest.json`

## How it works

- the content script adds a download button next to the main player's play button and in the playlist view
- on click, the extension retrieves the track URL (or ask for login if not authentified yet)
- the background script calls the local Python backend
- the backend executes `tiddl download -q max url <mediaUrl>`

## Tiddl backend

The business logic is in `run_user_script()` in `backend/main.py`.

The backend expects `mediaUrl` and runs the command:

```bash
tiddl download -q max url <mediaUrl>
```

## Quick test

Once the backend is running and the extension is loaded:

1. open a page matching `matches`
2. click on one of the download buttons
3. verify the success message displayed on the page

## Limitations

- The Python backend must be started locally
- This version uses local HTTP, not Native Messaging
