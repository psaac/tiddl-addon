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

## Starting the Python backend with Docker

### Build and run with Docker Compose (recommended)

```bash
docker-compose up -d
```

This will build the Docker image and start the backend container. The server will be accessible at `http://localhost:8765`.

To stop the container:

```bash
docker-compose down
```

### Manual Docker build and run

Build the image:

```bash
docker build -t tiddl-backend .
```

Run the container:

```bash
docker run -d -p 8765:8765 \
  -e BACKEND_HOST=0.0.0.0 \
  -v ~/.tiddl:/root/.tiddl \
  --name tiddl-backend \
  tiddl-backend
```

The `-v ~/.tiddl:/root/.tiddl` flag mounts your tiddl config directory from the host machine into the container.

### GitHub Actions Pipeline

This project includes a GitHub Actions workflow (`.github/workflows/docker-build.yml`) that automatically builds and publishes the Docker image to the GitHub Container Registry (GHCR).

**Features:**

- Automatic build and push on commits to `main` branch
- Automatic build and push on git tags (semantic versioning)
- Images are tagged with:
  - `latest` - for commits to main
  - `main-<commit-hash>` - for each commit to main
  - `<version>` - for git tags (e.g., `v1.0.0`, `1.0`, `1`)

**Prerequisites:**

- GitHub Actions is enabled (enabled by default for public repos)
- No additional configuration needed - `GITHUB_TOKEN` is automatically available

**Usage:**

- Push to `main` branch - image is built and published with `latest` tag
- Create a git tag - image is published with that version tag

  ```bash
  git tag v1.0.0
  git push origin v1.0.0
  ```

**Pulling the image:**

```bash
docker pull ghcr.io/psaac/tiddl-addon/tiddl-backend:latest
```

Login to GHCR if needed:

```bash
echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
```

## Installing the extension in Firefox (dev mode)

1. Open `about:debugging#/runtime/this-firefox`
2. Click on `Load Temporary Add-on`
3. Select `firefox-addon/manifest.json`

## Packaging the addon

```bash
cd firefox-addon
zip -r ../tiddl-local-runner.zip manifest.json background.js content-script.js content-style.css
```

## Installing the extension in Firefox (Permanently)

1. In Firefox, go to "about:config" and enter "xpinstall.signatures.required" in search bar. Ensure it is set to false
2. Go to about:addons
3. Drag'n'drop the zip file previously packaged

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

## Usage

Once the backend is running and the extension is loaded:

1. open tidal in Firefox
2. click on one of the download buttons
3. verify the success message displayed on the page

## Limitations

- This version uses local HTTP, not Native Messaging
- The Firefox extension and backend must be on the same machine (or the backend must be accessible from the browser)

## TODO

Fix download location as it is now downloaded inside docker container
