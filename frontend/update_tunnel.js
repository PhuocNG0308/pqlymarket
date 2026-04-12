const { execSync } = require('child_process');
const yaml = require('js-yaml');
const fs = require('fs');

console.log("To setup originRequest settings on a locally managed Cloudflared instance, you would need to use config.yml instead of quick tokens. Since you ran it via quick token (`tunnel run --token ...`), Cloudflare manages the routing 100% cloud-side.");
