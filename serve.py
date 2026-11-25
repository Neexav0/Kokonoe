"""Local dev server for Kokonoe with HTTP range support.

Python's built-in `http.server` ignores Range requests, so browsers can't
seek inside videos (start frames, looping, scrubbing all break). This
serves the kokonoe folder and answers Range requests with 206 responses.

    python kokonoe/serve.py [port]      ->  http://localhost:5181/
"""
import functools
import http.server
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
RANGE = re.compile(r"bytes=(\d*)-(\d*)$")


class Handler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        self._remaining = None
        header = self.headers.get("Range")
        path = self.translate_path(self.path)
        match = RANGE.match(header.strip()) if header else None
        if not match or os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None
        size = os.fstat(f.fileno()).st_size
        first, last = match.groups()
        if first == "":
            start, end = max(0, size - int(last or 0)), size - 1
        else:
            start = int(first)
            end = min(int(last), size - 1) if last else size - 1
        if start >= size or start > end:
            f.close()
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        f.seek(start)
        self._remaining = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        # Browsers drop video connections all the time; that's not an error.
        try:
            if self._remaining is None:
                return super().copyfile(source, outputfile)
            while self._remaining > 0:
                chunk = source.read(min(1 << 16, self._remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                self._remaining -= len(chunk)
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5181
    handler = functools.partial(Handler, directory=ROOT)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"Kokonoe on http://localhost:{port}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
