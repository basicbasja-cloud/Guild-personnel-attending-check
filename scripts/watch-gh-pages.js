// Poll origin/gh-pages and report when it changes
// Usage: node scripts/watch-gh-pages.js [intervalSec=10] [maxAttempts=90]

const { execSync } = require('child_process');

function getRemoteHash() {
  try {
    const out = execSync('git ls-remote origin refs/heads/gh-pages', { encoding: 'utf8' }).trim();
    if (!out) return null;
    return out.split(/\s+/)[0];
  } catch (e) {
    return null;
  }
}

const intervalSec = Number(process.argv[2] || 10);
const maxAttempts = Number(process.argv[3] || 90);

const initial = getRemoteHash();
console.log(new Date().toISOString(), 'initial origin/gh-pages:', initial || '<none>');

let attempts = 0;

const timer = setInterval(() => {
  attempts++;
  const cur = getRemoteHash();
  console.log(new Date().toISOString(), `attempt ${attempts}: origin/gh-pages:`, cur || '<none>');
  if (initial === null && cur !== null) {
    console.log('gh-pages branch created:', cur);
    clearInterval(timer);
    process.exit(0);
  }
  if (initial !== null && cur !== null && cur !== initial) {
    console.log('gh-pages updated:', cur);
    clearInterval(timer);
    process.exit(0);
  }
  if (attempts >= maxAttempts) {
    console.log('timeout: no change detected after', attempts, 'attempts');
    clearInterval(timer);
    process.exit(2);
  }
}, intervalSec * 1000);

process.on('SIGINT', () => {
  console.log('Watcher interrupted');
  clearInterval(timer);
  process.exit(130);
});
