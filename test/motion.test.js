// Reduced motion: which image an emote shows.

var query = { matches: false };
var matchMedia = q => (q === '(prefers-reduced-motion: reduce)' ? query : null);
loadConst(['ALLOWED_CDN_HOSTS', 'reducedMotionQuery']);
load(['safeUrl', 'prefersReducedMotion', 'emoteDisplayUrl']);

var animated7tv = {
  url: 'https://cdn.7tv.app/emote/A/2x.gif',
  staticUrl: 'https://cdn.7tv.app/emote/A/2x_static.webp',
  animated: true,
};
var animatedBttv = { url: 'https://cdn.betterttv.net/emote/b/2x.gif', animated: true };
var badStill = { url: 'https://cdn.7tv.app/emote/C/2x.gif', staticUrl: 'https://evil.example/x.png' };

check('motion allowed: animated URL', emoteDisplayUrl(animated7tv) === animated7tv.url);
query.matches = true;
check('reduced motion: still frame', emoteDisplayUrl(animated7tv) === animated7tv.staticUrl);
check('reduced motion, no still frame (BTTV): animated URL', emoteDisplayUrl(animatedBttv) === animatedBttv.url);
check('a still frame failing safeUrl falls back to the emote', emoteDisplayUrl(badStill) === badStill.url);
check('an emote failing safeUrl gives nothing', emoteDisplayUrl({ url: 'http://cdn.7tv.app/x' }) === '');
query.matches = false;
check('follows the query live', emoteDisplayUrl(animated7tv) === animated7tv.url);
