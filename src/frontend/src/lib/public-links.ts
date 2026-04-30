export function publicRoadmapPath(handle: string, slug: string | null | undefined) {
  const encodedHandle = encodeURIComponent(handle);
  if (!slug) {
    return `/u/${encodedHandle}`;
  }

  return `/u/${encodedHandle}/${encodeURIComponent(slug)}`;
}

export function publicRoadmapUrl(origin: string, handle: string, slug: string | null | undefined) {
  return `${origin}${publicRoadmapPath(handle, slug)}`;
}
