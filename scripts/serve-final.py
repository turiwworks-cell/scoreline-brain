"""Serve the saved production build locally; no installation or build is required."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import argparse
import mimetypes

ROOT = Path(__file__).resolve().parent.parent
DIST = (ROOT / 'dist').resolve()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        request_path = unquote(urlsplit(self.path).path)
        path = (DIST / request_path.lstrip('/')).resolve()
        if not path.is_relative_to(DIST):
            self.send_error(403)
            return
        if path.is_dir():
            path = path / 'index.html'
        if not path.is_file():
            if Path(request_path).suffix or request_path.startswith(('/assets/', '/img/', '/rive/', '/fonts/', '/api/')):
                self.send_error(404)
                return
            path = DIST / 'index.html'
        data = path.read_bytes()
        mime = mimetypes.guess_type(path)[0] or 'application/octet-stream'
        if mime.startswith('text/'):
            mime += '; charset=utf-8'
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'public, max-age=3600' if request_path.startswith('/img/players/') else 'no-store')
        self.end_headers()
        self.wfile.write(data)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4212)
    args = parser.parse_args()
    if not (DIST / 'index.html').is_file():
        raise SystemExit('Extract the complete Scoreline ZIP first; dist/index.html is missing.')
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    except OSError as error:
        raise SystemExit(f'Cannot start port {args.port}: {error}. Use --port to choose another port.')
    print('Scoreline LATEST - follow-up fixes - 2026-10-09', flush=True)
    print(f'http://localhost:{args.port}/review.html', flush=True)
    print('Keep this window open. Ctrl+C stops Scoreline.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
