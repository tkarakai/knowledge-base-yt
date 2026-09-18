"""One bounded caption fetch. No video/audio downloads or credential export."""
import json
import re
import sys
import yt_dlp


class Logger:
    def debug(self, message):
        pass

    def warning(self, message):
        # Signed caption URLs and cookies must never reach diagnostics.
        print(re.sub(r"https?://\S+", "[URL omitted]", message), file=sys.stderr)

    error = warning


video_id, language = sys.argv[1:3]
if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
    raise ValueError("Invalid video ID")
options = {
    "logger": Logger(), "skip_download": True, "noplaylist": True,
    "socket_timeout": 15, "retries": 0, "extractor_retries": 0,
    "ignore_no_formats_error": True,
}
if len(sys.argv) > 3 and sys.argv[3]:
    # Browser name only; yt-dlp decrypts locally and sends cookies only to YouTube.
    if sys.argv[3] not in ("chrome", "edge", "firefox", "safari", "brave", "chromium"):
        raise ValueError("Unsupported browser")
    options["cookiesfrombrowser"] = (sys.argv[3],)
try:
    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
        candidates = []
        for generated, tracks in ((False, info.get("subtitles", {})), (True, info.get("automatic_captions", {}))):
            for lang, formats in tracks.items():
                # Prefer original speech over machine translations, and human captions.
                for track in formats:
                    if track.get("ext") == "json3":
                        original = "tlang=" not in track["url"]
                        rank = (lang.split("-")[0] != language.split("-")[0], not original, generated, lang != language)
                        candidates.append((rank, lang, generated, track))
        if not candidates:
            print(json.dumps({"status": "unavailable", "error": "YouTube exposes no caption tracks for this video."}))
        else:
            _, lang, generated, track = sorted(candidates, key=lambda item: item[0])[0]
            with ydl.urlopen(track["url"]) as response:
                raw = response.read(2 * 1024 * 1024 + 1)
            if len(raw) > 2 * 1024 * 1024:
                raise ValueError("Caption response exceeds 2 MiB")
            if not raw.strip():
                raise ValueError("YouTube returned empty captions; browser verification or a subtitle PO token may be required")
            print(json.dumps({"status": "available", "language": lang.removesuffix("-orig"), "generated": generated, "captions": json.loads(raw)}))
except Exception as error:
    print(json.dumps({"status": "failed", "error": re.sub(r"https?://\S+", "[URL omitted]", str(error))[:4000]}))
    sys.exit(1)
