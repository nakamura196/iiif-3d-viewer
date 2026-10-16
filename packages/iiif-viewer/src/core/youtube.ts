// A YouTube page given as the body of a Video painting annotation.
// IIIF has no YouTube profile; manifests in the wild put the watch / short / embed URL in the body `id`.
// Such a body is played in YouTube's own player (the video is not copied).

const ID = /^[A-Za-z0-9_-]{11}$/;

/** The 11-character video id of a YouTube URL, or null when the URL is not a YouTube video. */
export const youTubeIdOf = (url: string): string | null => {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = /^\/(?:embed|shorts|live|v)\/([^/]+)/.exec(u.pathname);
      id = m ? m[1] : null;
    }
  }
  return id && ID.test(id) ? id : null;
};

/** Where the URL asks the video to start (`t=90`, `t=1m30s`, `start=90`), in seconds; 0 when it does not. */
export const youTubeStartOf = (url: string): number => {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 0;
  }
  const t = u.searchParams.get('t') ?? u.searchParams.get('start');
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
};
