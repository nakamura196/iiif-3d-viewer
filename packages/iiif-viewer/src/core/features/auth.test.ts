import { describe, expect, it } from 'vitest';
import { parseProbeResult, parseTokenMessage, probeServiceOf } from './auth';

const label = (t: string) => ({ en: [t] });
const probe = {
  id: 'https://auth.example.org/probe/x',
  type: 'AuthProbeService2',
  service: [
    {
      id: 'https://auth.example.org/login',
      type: 'AuthAccessService2',
      profile: 'active',
      label: label('Login'),
      heading: label('Please Log In'),
      note: label('Needs an account'),
      confirmLabel: label('Go'),
      service: [
        { id: 'https://auth.example.org/token', type: 'AuthAccessTokenService2' },
        { id: 'https://auth.example.org/logout', type: 'AuthLogoutService2', label: label('Logout') },
      ],
    },
    {
      type: 'AuthAccessService2',
      profile: 'external',
      service: [{ id: 'https://auth.example.org/token2', type: 'AuthAccessTokenService2' }],
    },
  ],
};

describe('probeServiceOf', () => {
  it('finds a probe nested in the image service of a body', () => {
    const body = { type: 'Image', service: [{ id: 'https://i.example.org/x', type: 'ImageService3', service: [probe] }] };
    const p = probeServiceOf(body);
    expect(p?.id).toBe('https://auth.example.org/probe/x');
    // external first, then active
    expect(p?.access.map((a) => a.profile)).toEqual(['external', 'active']);
    const active = p!.access[1];
    expect(active).toMatchObject({
      id: 'https://auth.example.org/login',
      heading: 'Please Log In',
      confirmLabel: 'Go',
      tokenId: 'https://auth.example.org/token',
      logout: { id: 'https://auth.example.org/logout', label: 'Logout' },
    });
    expect(p!.access[0].id).toBeUndefined();
  });

  it('finds a probe directly on the body, and in an info.json', () => {
    expect(probeServiceOf({ service: [probe] })?.id).toBe(probe.id);
    expect(probeServiceOf({ '@context': 'x', width: 1, height: 1, service: [probe] })?.id).toBe(probe.id);
  });

  it('ignores access services without a token service, and plain image services', () => {
    expect(probeServiceOf({ service: [{ id: 'https://i.example.org/x', type: 'ImageService3' }] })).toBeUndefined();
    const bad = { ...probe, service: [{ id: 'https://a', type: 'AuthAccessService2', profile: 'active' }] };
    expect(probeServiceOf({ service: [bad] })?.access).toEqual([]);
  });
});

describe('parseProbeResult', () => {
  it('reads status, heading and note', () => {
    const r = parseProbeResult({ type: 'AuthProbeResult2', status: 401, heading: label('No'), note: label('Because') });
    expect(r).toEqual({ status: 401, heading: 'No', note: 'Because' });
  });
  it('reads a location', () => {
    const r = parseProbeResult({
      type: 'AuthProbeResult2',
      status: 302,
      location: { id: 'https://x/y.jpg', type: 'Image', service: [{ id: 'https://x/y/', type: 'ImageService3' }] },
    });
    expect(r?.location).toEqual({ id: 'https://x/y.jpg', type: 'Image', serviceId: 'https://x/y' });
  });
  it('rejects other JSON', () => {
    expect(parseProbeResult({ type: 'Other', status: 200 })).toBeNull();
    expect(parseProbeResult('x')).toBeNull();
  });
});

describe('parseTokenMessage', () => {
  it('reads a token for the same messageId only', () => {
    const data = { type: 'AuthAccessToken2', accessToken: 'abc', expiresIn: 300, messageId: 'm1' };
    expect(parseTokenMessage(data, 'm1')).toEqual({ ok: true, accessToken: 'abc', expiresIn: 300 });
    expect(parseTokenMessage(data, 'm2')).toBeNull();
  });
  it('reads an error', () => {
    const data = { type: 'AuthAccessTokenError2', profile: 'missingAspect', messageId: 'm1', heading: label('Unauthorized') };
    expect(parseTokenMessage(data, 'm1')).toEqual({ ok: false, profile: 'missingAspect', heading: 'Unauthorized' });
  });
  it('ignores unrelated messages', () => {
    expect(parseTokenMessage({ foo: 1 }, 'm1')).toBeNull();
    expect(parseTokenMessage(null, 'm1')).toBeNull();
  });
});
