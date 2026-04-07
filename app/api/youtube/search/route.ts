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

    const results = await Promise.all(
      songs.map(async (song: { title: string; artist: string }) => {
        const videoId = await searchYouTube(song.title, song.artist);
        return { ...song, videoId };
      })
    );

    const resolved = results.filter((s) => Boolean(s.videoId)).length;
    carveDebugServer("api.youtube.search.done", {
      resolvedVideoIds: resolved,
      unresolved: songs.length - resolved,
    });

    return NextResponse.json({ songs: results });
  } catch (error) {
    console.error("YouTube search error:", error);
    return NextResponse.json(
      { error: "Failed to search YouTube" },
      { status: 500 }
    );
  }
}
