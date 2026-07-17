FROM python:3.13-slim

# Install uv
RUN pip install --no-cache-dir uv

# Set working directory
WORKDIR /app

# Copy backend files
COPY backend/ /app/backend/

# Install tiddl via uv
RUN uv tool install --python python3.13 tiddl==3.4.4

# Expose the port
EXPOSE 8765

# Run the backend server
CMD ["python", "backend/main.py"]
