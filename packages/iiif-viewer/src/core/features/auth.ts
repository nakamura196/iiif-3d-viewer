// auth: IIIF Authorization Flow API 2.0 の読み取り（React に依存しない）。
// https://iiif.io/api/auth/2.0/
//
// 画像の service（body.service[ImageService3].service[AuthProbeService2]）や info.json の
// service から Probe service を取り出し、Probe の応答・トークンの postMessage を読む。
// 通信と画面は react/auth/ が行う。
import { labelIn } from '../services/paintedModels';

type Json = Record<string, unknown>;

const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
const idOf = (v: Json): string | undefined => str(v.id) ?? str(v['@id']);
const typeOf = (v: Json): string => str(v.type) ?? str(v['@type']) ?? '';

export type AuthProfile = 'active' | 'kiosk' | 'external';

export interface AuthLogoutRef {
  id: string;
  label: string;
}

export interface AuthAccessRef {
  profile: AuthProfile;
  /** The access service URL. Absent for "external" (nothing is opened). */
  id?: string;
  label: string;
  heading: string;
  note: string;
  confirmLabel: string;
  /** The AuthAccessTokenService2 that goes with it. */
  tokenId: string;
  tokenErrorHeading: string;
  tokenErrorNote: string;
  logout?: AuthLogoutRef;
}

export interface AuthProbeRef {
  /** The AuthProbeService2 URL. */
  id: string;
  /** In the order to try (see `ACCESS_ORDER`). */
  access: AuthAccessRef[];
  errorHeading: string;
  errorNote: string;
}

/**
 * The order access services are tried in. The spec leaves the choice to the client and lists
 * external, kiosk, active: "external" needs no window at all, "kiosk" opens a window without
 * asking, "active" needs the user to act, so it comes last.
 */
export const ACCESS_ORDER: AuthProfile[] = ['external', 'kiosk', 'active'];

const profileOf = (v: unknown): AuthProfile | undefined =>
  v === 'active' || v === 'kiosk' || v === 'external' ? v : undefined;

const servicesOf = (resource: Json): Json[] =>
  [...asList(resource.service), ...asList(resource.services)].filter(isObj);

const accessOf = (raw: Json, locale: string): AuthAccessRef | undefined => {
  if (typeOf(raw) !== 'AuthAccessService2') return undefined;
  const profile = profileOf(raw.profile);
  if (!profile) return undefined;
  const id = idOf(raw);
  if (profile !== 'external' && !id) return undefined;
  const subs = servicesOf(raw);
  const token = subs.find((s) => typeOf(s) === 'AuthAccessTokenService2');
  const tokenId = token && idOf(token);
  if (!token || !tokenId) return undefined;
  const logoutRaw = subs.find((s) => typeOf(s) === 'AuthLogoutService2');
  const logoutId = logoutRaw && idOf(logoutRaw);
  return {
    profile,
    ...(id ? { id } : {}),
    label: labelIn(raw.label, locale),
    heading: labelIn(raw.heading, locale),
    note: labelIn(raw.note, locale),
    confirmLabel: labelIn(raw.confirmLabel, locale),
    tokenId,
    tokenErrorHeading: labelIn(token.errorHeading, locale),
    tokenErrorNote: labelIn(token.errorNote, locale),
    ...(logoutRaw && logoutId ? { logout: { id: logoutId, label: labelIn(logoutRaw.label, locale) } } : {}),
  };
};

const probeOf = (raw: Json, locale: string): AuthProbeRef | undefined => {
  if (typeOf(raw) !== 'AuthProbeService2') return undefined;
  const id = idOf(raw);
  if (!id) return undefined;
  const access = servicesOf(raw)
    .map((s) => accessOf(s, locale))
    .filter((a): a is AuthAccessRef => !!a)
    .sort((a, b) => ACCESS_ORDER.indexOf(a.profile) - ACCESS_ORDER.indexOf(b.profile));
  return { id, access, errorHeading: labelIn(raw.errorHeading, locale), errorNote: labelIn(raw.errorNote, locale) };
};

/**
 * The AuthProbeService2 of a resource: on its `service`, or on the services nested in its image
 * service (manifests usually write body.service[ImageService3].service[AuthProbeService2]).
 * The same works for an info.json, whose `service` array may declare it.
 */
export const probeServiceOf = (resource: unknown, locale = 'en'): AuthProbeRef | undefined => {
  if (!isObj(resource)) return undefined;
  const top = servicesOf(resource);
  for (const s of top) {
    const probe = probeOf(s, locale);
    if (probe) return probe;
  }
  for (const s of top) {
    for (const nested of servicesOf(s)) {
      const probe = probeOf(nested, locale);
      if (probe) return probe;
    }
  }
  return undefined;
};

export interface AuthSubstitute {
  id: string;
  type: string;
  /** Image API service of the substitute, when it has one. */
  serviceId?: string;
}

export interface AuthProbeResult {
  /** The HTTP status the resource would answer with. */
  status: number;
  location?: AuthSubstitute;
  heading?: string;
  note?: string;
}

/** An AuthProbeResult2. */
export const parseProbeResult = (json: unknown, locale = 'en'): AuthProbeResult | null => {
  if (!isObj(json) || typeOf(json) !== 'AuthProbeResult2') return null;
  const status = Number(json.status);
  if (!Number.isInteger(status)) return null;
  const out: AuthProbeResult = { status };
  if (isObj(json.location)) {
    const id = idOf(json.location);
    if (id) {
      const image = servicesOf(json.location).find((s) => /ImageService/i.test(typeOf(s)));
      const serviceId = image && idOf(image);
      out.location = { id, type: typeOf(json.location), ...(serviceId ? { serviceId: serviceId.replace(/\/+$/, '') } : {}) };
    }
  }
  const heading = labelIn(json.heading, locale);
  const note = labelIn(json.note, locale);
  if (heading) out.heading = heading;
  if (note) out.note = note;
  return out;
};

export type AuthTokenMessage =
  | { ok: true; accessToken: string; expiresIn?: number }
  | { ok: false; profile: string; heading?: string; note?: string };

/** The postMessage data of a token service: AuthAccessToken2 or AuthAccessTokenError2 for `messageId`. */
export const parseTokenMessage = (data: unknown, messageId: string, locale = 'en'): AuthTokenMessage | null => {
  if (!isObj(data) || data.messageId !== messageId) return null;
  if (data.type === 'AuthAccessToken2') {
    const accessToken = str(data.accessToken);
    if (!accessToken) return null;
    const expiresIn = Number(data.expiresIn);
    return { ok: true, accessToken, ...(expiresIn > 0 ? { expiresIn } : {}) };
  }
  if (data.type === 'AuthAccessTokenError2') {
    const heading = labelIn(data.heading, locale);
    const note = labelIn(data.note, locale);
    return { ok: false, profile: str(data.profile) ?? 'unavailable', ...(heading ? { heading } : {}), ...(note ? { note } : {}) };
  }
  return null;
};

/**
 * The URL to load for a resource that is fetched whole (a 3D model): the resource itself when it
 * has no probe or the probe allows it, the probe's `location` when it gives one (e.g. a signed URL),
 * and null while the user has not been let in yet.
 */
export const authorizedUrl = (
  url: string,
  state: { phase: string; location?: AuthSubstitute } | undefined,
): string | null => {
  if (!state) return url;
  if (state.phase !== 'ok') return null;
  return state.location?.id ?? url;
};
