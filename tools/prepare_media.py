"""Copy the heroine clips into kokonoe/media, ready for streaming.

Some MP4s store their index (the `moov` box) after the video data, so a
browser has to download the whole file before it can show a frame. This
moves `moov` in front of the data ("faststart") and shifts the chunk
offsets to match. Files that are already streamable are copied as they are.
The source files are never modified.

    python kokonoe/tools/prepare_media.py
"""
import os
import shutil
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, "..", "..", "Anime-Iconic-Faces", "Videos"))
DST = os.path.normpath(os.path.join(HERE, "..", "media"))
CLIPS = ["makima", "mikasa", "yor", "shinobu", "mitsuri", "marin", "robin", "hinata", "waguri"]
CONTAINERS = {b"moov", b"trak", b"mdia", b"minf", b"stbl", b"edts"}


def top_level_boxes(f, size):
    pos = 0
    while pos < size:
        f.seek(pos)
        head = f.read(8)
        if len(head) < 8:
            break
        box_size, box_type = struct.unpack(">I4s", head)
        if box_size == 1:
            box_size = struct.unpack(">Q", f.read(8))[0]
        elif box_size == 0:
            box_size = size - pos
        yield box_type, pos, box_size
        pos += box_size


def shift_offsets(moov, delta):
    """Add `delta` to every stco/co64 chunk offset inside a moov bytearray."""
    def walk(start, end):
        pos = start
        while pos + 8 <= end:
            box_size, box_type = struct.unpack(">I4s", moov[pos:pos + 8])
            header = 8
            if box_size == 1:
                box_size = struct.unpack(">Q", moov[pos + 8:pos + 16])[0]
                header = 16
            if box_size < header:
                return
            body = pos + header
            if box_type in CONTAINERS:
                walk(body, pos + box_size)
            elif box_type == b"stco":
                count = struct.unpack(">I", moov[body + 4:body + 8])[0]
                for i in range(count):
                    at = body + 8 + i * 4
                    value = struct.unpack(">I", moov[at:at + 4])[0] + delta
                    if value > 0xFFFFFFFF:
                        raise ValueError("offset overflow; file too large for stco")
                    moov[at:at + 4] = struct.pack(">I", value)
            elif box_type == b"co64":
                count = struct.unpack(">I", moov[body + 4:body + 8])[0]
                for i in range(count):
                    at = body + 8 + i * 8
                    value = struct.unpack(">Q", moov[at:at + 8])[0] + delta
                    moov[at:at + 8] = struct.pack(">Q", value)
            pos += box_size

    walk(0, len(moov))


def prepare(src, dst):
    size = os.path.getsize(src)
    with open(src, "rb") as f:
        boxes = list(top_level_boxes(f, size))
        kinds = [b[0] for b in boxes]
        if b"moov" not in kinds or b"mdat" not in kinds or kinds.index(b"moov") < kinds.index(b"mdat"):
            shutil.copyfile(src, dst)
            return "copied (already streamable)"
        moov_box = next(b for b in boxes if b[0] == b"moov")
        f.seek(moov_box[1])
        moov = bytearray(f.read(moov_box[2]))
        shift_offsets(moov, len(moov))
        with open(dst, "wb") as out:
            ftyp = [b for b in boxes if b[0] == b"ftyp"]
            for _, pos, box_size in ftyp:
                f.seek(pos)
                out.write(f.read(box_size))
            out.write(moov)
            for box_type, pos, box_size in boxes:
                if box_type in (b"ftyp", b"moov"):
                    continue
                f.seek(pos)
                remaining = box_size
                while remaining:
                    chunk = f.read(min(1 << 20, remaining))
                    out.write(chunk)
                    remaining -= len(chunk)
        return "faststart (moov moved to the front)"


def main():
    os.makedirs(DST, exist_ok=True)
    for name in CLIPS:
        src = os.path.join(SRC, name + ".mp4")
        if not os.path.exists(src):
            print(f"missing: {src}", file=sys.stderr)
            continue
        print(f"{name}.mp4: {prepare(src, os.path.join(DST, name + '.mp4'))}")


if __name__ == "__main__":
    main()
