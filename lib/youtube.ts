export async function searchYouTube(
  title: string,
  artist: string
): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY || "";
  if (!apiKey.trim()) {
    throw new Error("YOUTUBE_API_KEY_MISSING");
  }

  const query = `${title} ${artist} official audio`;
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    videoCategoryId: "10", // Music category
    maxResults: "1",
    key: apiKey,
  });

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`
  );

  if (!res.ok) {
    const body = await res.text();
    try {
      const parsed = JSON.parse(body) as {
        error?: { errors?: { reason?: string }[]; message?: string };
      };
      const reason = parsed.error?.errors?.[0]?.reason;
      if (reason === "quotaExceeded") {
        throw new Error("YOUTUBE_QUOTA_EXCEEDED");
      }
    } catch {
      // ignore parse failures; fall through
    }
    throw new Error(`YOUTUBE_SEARCH_HTTP_${res.status}`);
  }

  const data = await res.json();
  if (data.items && data.items.length > 0) {
    return data.items[0].id.videoId;
  }

  return null;
}
