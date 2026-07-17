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

### GitLab CI/CD Pipeline

This project includes a GitLab CI/CD pipeline (`.gitlab-ci.yml`) that automatically builds and publishes the Docker image to the GitLab Container Registry.

**Features:**

- Automatic build on commits to `main` branch
- Automatic build and publish on git tags
- Images are tagged with:
  - `latest` - for commits to main
  - `<commit-hash>` - for each commit (8 characters)
  - `<version-tag>` - for git tags (e.g., `v1.0.0`)

**Prerequisites:**

- GitLab CI/CD is enabled (enabled by default)
- No additional setup needed - CI/CD variables are automatically available

**Usage:**

- Push to `main` branch - image is built and published as `latest`
- Create a git tag - image is published with that tag

  ```bash
  git tag v1.0.0
  git push origin v1.0.0
  ```

**Pulling the image:**

```bash
docker pull registry.gitlab.com/<group>/<project>/tiddl-backend:latest
```

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

## Usage

Once the backend is running and the extension is loaded:

1. open tidal in Firefox
2. click on one of the download buttons
3. verify the success message displayed on the page

## Limitations

- This version uses local HTTP, not Native Messaging
- The Firefox extension and backend must be on the same machine (or the backend must be accessible from the browser)
