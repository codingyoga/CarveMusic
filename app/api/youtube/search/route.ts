import { NextRequest, NextResponse } from "next/server";
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

    const results = await Promise.all(
      songs.map(async (song: { title: string; artist: string }) => {
        const videoId = await searchYouTube(song.title, song.artist);
        return { ...song, videoId };
      })
    );

    return NextResponse.json({ songs: results });
  } catch (error) {
    console.error("YouTube search error:", error);
    return NextResponse.json(
      { error: "Failed to search YouTube" },
      { status: 500 }
    );
  }
}
