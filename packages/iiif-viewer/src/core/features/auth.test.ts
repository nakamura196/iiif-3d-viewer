import { describe, expect, it } from 'vitest';
import { authorizedUrl, parseProbeResult, parseTokenMessage, probeServiceOf } from './auth';

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
  it('reads a substitute (status 401): an image service itself, or a resource with one', () => {
    const svc = 'https://example.org/image/pic-degraded';
    const r = parseProbeResult({
      type: 'AuthProbeResult2',
      status: 401,
      substitute: [{ id: svc, type: 'ImageService3', profile: 'level0' }],
    });
    expect(r?.substitute).toEqual({ id: svc, type: 'ImageService3', serviceId: svc });
    const viaBody = parseProbeResult({
      type: 'AuthProbeResult2',
      status: 401,
      substitute: [{ id: `${svc}/full/max/0/default.jpg`, type: 'Image', service: [{ id: `${svc}/`, type: 'ImageService3' }] }],
    });
    expect(viaBody?.substitute?.serviceId).toBe(svc);
    // a single object (older servers) is read too; a substitute with another status is not
    expect(parseProbeResult({ type: 'AuthProbeResult2', status: 401, substitute: { id: svc, type: 'ImageService3' } })?.substitute?.id).toBe(svc);
    expect(parseProbeResult({ type: 'AuthProbeResult2', status: 200, substitute: [{ id: svc, type: 'ImageService3' }] })?.substitute).toBeUndefined();
    expect(parseProbeResult({ type: 'AuthProbeResult2', status: 401, substitute: [] })?.substitute).toBeUndefined();
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

describe('authorizedUrl', () => {
  const url = 'https://example.org/model.glb';
  it('loads the resource itself when it has no probe', () => {
    expect(authorizedUrl(url, undefined)).toBe(url);
  });
  it('waits while the user is not let in', () => {
    for (const phase of ['probing', 'prompt', 'working', 'denied']) expect(authorizedUrl(url, { phase })).toBeNull();
  });
  it('loads the substitute (e.g. a degraded copy) while the user is not let in', () => {
    const low = 'https://example.org/model-low.glb';
    expect(authorizedUrl(url, { phase: 'prompt', substitute: { id: low, type: 'Model' } })).toBe(low);
    expect(authorizedUrl(url, { phase: 'ok', substitute: { id: low, type: 'Model' } })).toBe(url);
  });
  it('loads the probe location (e.g. a signed URL) once allowed, or the resource itself', () => {
    const signed = 'https://example.org/files/model.glb?exp=1&sig=x';
    expect(authorizedUrl(url, { phase: 'ok', location: { id: signed, type: 'Model' } })).toBe(signed);
    expect(authorizedUrl(url, { phase: 'ok' })).toBe(url);
  });
});

describe('probeServiceOf on a Model', () => {
  it('reads an AuthProbeService2 written directly on the Model body', () => {
    const model = {
      id: 'https://example.org/files/m.glb',
      type: 'Model',
      service: [{ id: 'https://example.org/probe/m.glb', type: 'AuthProbeService2', service: [] }],
    };
    expect(probeServiceOf(model)?.id).toBe('https://example.org/probe/m.glb');
  });
});
