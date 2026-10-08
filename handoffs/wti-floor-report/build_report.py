"""Assemble the report page: inline the Brent data into the template and fail loudly on unfilled placeholders."""
import re, sys
from pathlib import Path

template, data, out = (Path(p) for p in sys.argv[1:4])
html = template.read_text()
html = html.replace("/*BRENT_DATA*/", data.read_text().strip())
left = re.findall(r"FILL:[\w-]+", html)
if left:
    sys.exit(f"Unfilled placeholders: {sorted(set(left))}")
out.write_text(html)
print(f"wrote {out} ({len(html):,} bytes)")
