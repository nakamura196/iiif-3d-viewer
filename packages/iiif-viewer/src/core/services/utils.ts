export const fetchManifest = async (manifestUrl: string) => {
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error('Failed to fetch manifest');
    const json = await response.json();
    // setManifest(json);
    return json;
  } catch (error) {
    console.error('Error fetching manifest:', error);
    return null;
  }
};
