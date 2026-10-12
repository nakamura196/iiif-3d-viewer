import { upgradeToV3 } from './upgradeV2';

export const fetchManifest = async (manifestUrl: string) => {
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error('Failed to fetch manifest');
    // Presentation 2 は 3 に直してから渡す（3 / 4 はそのまま）
    return upgradeToV3(await response.json());
  } catch (error) {
    console.error('Error fetching manifest:', error);
    return null;
  }
};
