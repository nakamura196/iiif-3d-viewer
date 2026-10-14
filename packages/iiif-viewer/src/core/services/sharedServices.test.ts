import { describe, expect, it } from 'vitest';
import { inlineSharedServices } from './sharedServices';
import { probeServiceOf } from '../features/auth';

// Wellcome Collection の書き方（b18659135, 2026-10-14 に確認）: 画像には probe と access の id だけ、
// access の中身はマニフェスト末尾の services にある。
const ACCESS = 'https://iiif.wellcomecollection.org/auth/v2/access/clickthrough';
const manifest = {
  type: 'Manifest',
  items: [
    {
      type: 'Canvas',
      items: [
        {
          type: 'AnnotationPage',
          items: [
            {
              type: 'Annotation',
              body: {
                id: 'https://iiif.wellcomecollection.org/image/b18659135_0001.jp2/full/full/0/default.jpg',
                type: 'Image',
                service: [
                  {
                    id: 'https://iiif.wellcomecollection.org/image/b18659135_0001.jp2',
                    type: 'ImageService3',
                    service: [
                      {
                        id: 'https://iiif.wellcomecollection.org/auth/v2/probe/b18659135_0001.jp2',
                        type: 'AuthProbeService2',
                        service: [{ id: ACCESS, type: 'AuthAccessService2' }],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  ],
  services: [
    {
      id: ACCESS,
      type: 'AuthAccessService2',
      profile: 'active',
      label: { en: ['Content advisory'] },
      service: [
        { id: 'https://iiif.wellcomecollection.org/auth/v2/access/token', type: 'AuthAccessTokenService2' },
        {
          id: 'https://iiif.wellcomecollection.org/auth/v2/access/clickthrough/logout',
          type: 'AuthLogoutService2',
          label: { en: ['Log out of Wellcome Collection'] },
        },
      ],
    },
  ],
};

const bodyOf = (m: typeof manifest) => m.items[0].items[0].items[0].body;

describe('inlineSharedServices', () => {
  it('replaces an id-only service with its description in `services`', () => {
    const probe = probeServiceOf(bodyOf(inlineSharedServices(manifest)));
    expect(probe?.access).toHaveLength(1);
    expect(probe?.access[0]).toMatchObject({
      profile: 'active',
      id: ACCESS,
      label: 'Content advisory',
      tokenId: 'https://iiif.wellcomecollection.org/auth/v2/access/token',
      logout: { label: 'Log out of Wellcome Collection' },
    });
  });

  it('finds no access service without it (the reason for inlining)', () => {
    expect(probeServiceOf(bodyOf(manifest))?.access).toHaveLength(0);
  });

  it('does not change the input', () => {
    inlineSharedServices(manifest);
    expect(bodyOf(manifest).service[0].service[0].service[0]).toEqual({ id: ACCESS, type: 'AuthAccessService2' });
  });

  it('stops at a service that refers to itself', () => {
    const loop = { id: 'x', type: 'Service', profile: 'p', service: [{ id: 'x', type: 'Service' }] };
    const out = inlineSharedServices({ items: [{ service: { id: 'x', type: 'Service' } }], services: [loop] });
    expect(out.items[0].service).toEqual({ id: 'x', type: 'Service', profile: 'p', service: [{ id: 'x', type: 'Service' }] });
  });

  it('returns a manifest without `services` as it is', () => {
    const m = { items: [] };
    expect(inlineSharedServices(m)).toBe(m);
  });
});
