#!/usr/bin/env python3
"""
Bluff or Believe — Local Development Server
Serves static assets, JSON datasets, and HTML with CORS headers enabled.
Automatically binds to a free port (8000-8020) and serves from project root.
Run with: python server.py
"""

import http.server
import socketserver
import os
import sys

DEFAULT_PORT = 8000

class CustomHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and disable aggressive caching for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

def main():
    # Ensure current working directory is the project root containing index.html
    project_root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_root)

    # Allow address reuse on socket
    socketserver.TCPServer.allow_reuse_address = True

    chosen_port = None
    httpd = None

    for port in range(DEFAULT_PORT, DEFAULT_PORT + 20):
        try:
            httpd = socketserver.TCPServer(("", port), CustomHTTPHandler)
            chosen_port = port
            break
        except OSError:
            continue

    if not httpd:
        print("ERROR: Could not find an available port between 8000 and 8020.")
        sys.exit(1)

    url = f"http://localhost:{chosen_port}"
    print("=" * 60, flush=True)
    print("BLUFF OR BELIEVE — LOCAL GAME SERVER RUNNING", flush=True)
    print("=" * 60, flush=True)
    print(f"Server address : {url}", flush=True)
    print(f"Serving files  : {project_root}", flush=True)
    print("-" * 60, flush=True)
    print("Open the link above in your browser to play!", flush=True)
    print("Press Ctrl+C to stop the server.", flush=True)
    print("=" * 60, flush=True)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        httpd.server_close()

if __name__ == "__main__":
    main()
