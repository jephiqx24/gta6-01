#!/bin/bash
# Launch headless Chromium for Solara City testing (CDP on port 9222).
# WebGL needs the Hatch policy file; tests run over the local server
# (http://localhost:8080) or over file:// URLs (SOLARA_BASE).
DOMAINS_FILE=/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt
SHA=$(sha256sum "$DOMAINS_FILE" | cut -d' ' -f1)
pkill -x chrome 2>/dev/null; sleep 1
/opt/meta-chromium/chrome \
  --headless=new \
  --no-sandbox \
  --disable-gpu-sandbox \
  --use-angle=swiftshader \
  --enable-unsafe-swiftshader \
  --hatch-webgl-allowed-domains-file="$DOMAINS_FILE" \
  --hatch-webgl-allowed-domains-sha256="$SHA" \
  --allow-file-access-from-files \
  --user-data-dir=/tmp/chrome-profile-solara \
  --remote-debugging-port=9222 \
  --window-size=1440,900 \
  about:blank > /tmp/chrome-solara.log 2>&1 &
echo "chrome pid $!"
sleep 3
curl -s http://127.0.0.1:9222/json/version | head -c 200; echo
