import { describe, expect, it } from 'vitest';
import { youTubeIdOf, youTubeStartOf } from './youtube';

describe('youTubeIdOf', () => {
  it('reads watch, short, embed and nocookie URLs', () => {
    expect(youTubeIdOf('https://www.youtube.com/watch?v=MT885UdXin4')).toBe('MT885UdXin4');
    expect(youTubeIdOf('https://youtu.be/MT885UdXin4?t=30')).toBe('MT885UdXin4');
    expect(youTubeIdOf('https://www.youtube.com/embed/9BqaU1h-mPM')).toBe('9BqaU1h-mPM');
    expect(youTubeIdOf('https://www.youtube-nocookie.com/embed/9BqaU1h-mPM?start=5')).toBe('9BqaU1h-mPM');
    expect(youTubeIdOf('https://m.youtube.com/watch?v=yYWa6bRMhL0&t=1m')).toBe('yYWa6bRMhL0');
    expect(youTubeIdOf('https://www.youtube.com/shorts/yYWa6bRMhL0')).toBe('yYWa6bRMhL0');
  });
  it('returns null for other URLs', () => {
    expect(youTubeIdOf('https://example.org/video.mp4')).toBeNull();
    expect(youTubeIdOf('https://www.youtube.com/channel/UCabc')).toBeNull();
    expect(youTubeIdOf('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(youTubeIdOf('not a url')).toBeNull();
  });
});

describe('youTubeStartOf', () => {
  it('reads seconds and h/m/s forms', () => {
    expect(youTubeStartOf('https://youtu.be/MT885UdXin4?t=90')).toBe(90);
    expect(youTubeStartOf('https://www.youtube.com/watch?v=MT885UdXin4&t=1m30s')).toBe(90);
    expect(youTubeStartOf('https://www.youtube.com/embed/MT885UdXin4?start=12')).toBe(12);
    expect(youTubeStartOf('https://www.youtube.com/watch?v=MT885UdXin4')).toBe(0);
  });
});
