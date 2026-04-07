export async function searchYouTube(
  title: string,
  artist: string
): Promise<string | null> {
  const query = `${title} ${artist} official audio`;
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    videoCategoryId: "10", // Music category
    maxResults: "1",
    key: process.env.YOUTUBE_API_KEY || "",
  });

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`
  );

  if (!res.ok) {
    console.error("YouTube search failed:", await res.text());
    return null;
  }

  const data = await res.json();
  if (data.items && data.items.length > 0) {
    return data.items[0].id.videoId;
  }

  return null;
}
