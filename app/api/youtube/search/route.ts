import { NextRequest, NextResponse } from "next/server";
import { carveDebugServer } from "@/lib/carveDebugLogFile";
import { searchYouTube } from "@/lib/youtube";

export async function POST(req: NextRequest) {
  try {
    const { songs } = await req.json();

    if (!songs || !Array.isArray(songs)) {
      return NextResponse.json(
        { error: "Songs array is required" },
        { status: 400 }
      );
    }

    carveDebugServer("api.youtube.search.start", {
      step: "POST /api/youtube/search",
      songCount: songs.length,
      provider: "YouTube Data API v3",
    });

    const results: Array<{ title: string; artist: string; videoId: string | null }> =
      [];
    let quotaExceeded = false;

    // Sequential to reduce quota spikes and allow early bail-out.
    for (const song of songs as Array<{ title: string; artist: string }>) {
      if (quotaExceeded) {
        results.push({ ...song, videoId: null });
        continue;
      }
      try {
        const videoId = await searchYouTube(song.title, song.artist);
        results.push({ ...song, videoId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "YOUTUBE_QUOTA_EXCEEDED") {
          quotaExceeded = true;
        }
        results.push({ ...song, videoId: null });
      }
    }

    const resolved = results.filter((s) => Boolean(s.videoId)).length;
    carveDebugServer("api.youtube.search.done", {
      resolvedVideoIds: resolved,
      unresolved: songs.length - resolved,
    });

    if (quotaExceeded) {
      return NextResponse.json(
        { error: "YouTube quota exceeded", songs: results },
        { status: 429 }
      );
    }

    return NextResponse.json({ songs: results });
  } catch (error) {
    console.error("YouTube search error:", error);
    return NextResponse.json(
      { error: "Failed to search YouTube" },
      { status: 500 }
    );
  }
}
