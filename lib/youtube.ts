const YOUTUBE_ID_PATTERN =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

export function getYouTubeVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_ID_PATTERN);
  return match ? match[1] : null;
}

export function toYouTubeEmbedUrl(url: string): string | null {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
