/**
 * YouTube Transcript Fetcher
 * Fetches transcripts from YouTube videos using multiple fallback methods
 */

interface TranscriptData {
  transcript: string;
  title: string | null;
  lengthSecs: number;
  viewCount: number;
  publishDate: string | null;
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Extract embedded JSON from HTML by variable name
 */
function extractEmbeddedJson(html: string, varName: string): string | null {
  let idx = html.indexOf(`var ${varName} = {`);
  let offset = `var ${varName} = `.length;
  if (idx === -1) {
    idx = html.indexOf(`${varName} = {`);
    offset = `${varName} = `.length;
  }
  if (idx === -1) return null;

  const jsonStart = idx + offset;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return html.substring(jsonStart, i + 1); }
  }
  return null;
}

/**
 * Parse YouTube XML transcript format
 */
function parseYoutubeXml(xml: string, title: string | null): string {
  function decodeEntities(s: string): string {
    return s.replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
  }

  const lines: string[] = [];
  const pMatches = [...xml.matchAll(/<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g)];

  if (pMatches.length > 0) {
    for (const [, , , inner] of pMatches) {
      const sMatches = [...inner.matchAll(/<s[^>]*>([^<]*)<\/s>/g)];
      const text = sMatches.length > 0
        ? sMatches.map(m => m[1]).join('')
        : inner.replace(/<[^>]+>/g, '');
      const decoded = decodeEntities(text).replace(/\n/g, ' ').trim();
      if (decoded) lines.push(decoded);
    }
  } else {
    for (const [, , , text] of xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)) {
      const decoded = decodeEntities(text).replace(/\n/g, ' ').trim();
      if (decoded) lines.push(decoded);
    }
  }

  // Group lines into paragraphs for better context
  const paragraphs: string[] = [];
  for (let i = 0; i < lines.length; i += 10) {
    paragraphs.push(lines.slice(i, i + 10).join(' '));
  }

  return paragraphs.join('\n\n');
}

/**
 * Fetch caption XML and parse it
 */
async function fetchCaptionXml(
  tracks: any[],
  title: string | null,
  lengthSecs: number,
  viewCount: number,
  publishDate: string | null,
  label: string
): Promise<TranscriptData> {
  const track = tracks.find((t: any) => (t.languageCode || t.language_code) === 'en')
    || tracks.find((t: any) => (t.languageCode || t.language_code || '').startsWith('en'))
    || tracks[0];
  const url = track.baseUrl || track.base_url;

  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' },
  });

  if (!res.ok) throw new Error(`Caption fetch ${res.status}`);
  const xml = await res.text();
  if (!xml || xml.length < 50) throw new Error('Empty caption response');

  const transcript = parseYoutubeXml(xml, title);
  return { transcript, title, lengthSecs, viewCount, publishDate };
}

/**
 * Fetch YouTube transcript using multiple fallback methods
 */
export async function fetchYoutubeTranscript(videoId: string): Promise<TranscriptData> {
  const tag = `[fetchTranscript ${videoId}]`;

  // Method 1: Supadata API (most reliable third-party service)
  const supadataKey = process.env.SUPADATA_API_KEY;
  if (supadataKey) {
    try {
      console.log(tag, 'trying Supadata API');
      const res = await fetch(`https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&text=true`, {
        headers: { 'x-api-key': supadataKey },
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.content;

        if (typeof content === 'string' && content.length > 20) {
          console.log(tag, 'Supadata: got plain text transcript, length:', content.length);
          return { transcript: content, title: data.title || null, lengthSecs: 0, viewCount: 0, publishDate: null };
        }

        if (Array.isArray(content) && content.length > 0) {
          const lines = content.map((s: any) => (s.text || '').trim()).filter(Boolean);
          if (lines.length > 0) {
            const paragraphs: string[] = [];
            for (let i = 0; i < lines.length; i += 10) {
              paragraphs.push(lines.slice(i, i + 10).join(' '));
            }
            console.log(tag, 'Supadata: got transcript:', lines.length, 'segments');
            return { transcript: paragraphs.join('\n\n'), title: data.title || null, lengthSecs: 0, viewCount: 0, publishDate: null };
          }
        }
      }
    } catch (e) {
      console.warn(tag, 'Supadata failed:', e instanceof Error ? e.message : e);
    }
  }

  // Method 2: HTML scrape with consent cookie
  try {
    console.log(tag, 'trying HTML scrape with consent cookie');
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const htmlRes = await fetch(watchUrl, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': 'CONSENT=PENDING+999; SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMwODI5LjA3X3AxGgJlbiACGgYIgJnSmgY',
      },
    });

    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const playerJsonStr = extractEmbeddedJson(html, 'ytInitialPlayerResponse');

      if (playerJsonStr) {
        const pj = JSON.parse(playerJsonStr);
        const ps = pj.playabilityStatus?.status;

        if (ps && ps !== 'OK') {
          throw new Error(`HTML scrape: ${ps}`);
        }

        const tracks = pj.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (tracks?.length) {
          return await fetchCaptionXml(
            tracks,
            pj.videoDetails?.title || null,
            parseInt(pj.videoDetails?.lengthSeconds || '0', 10),
            parseInt(pj.videoDetails?.viewCount || '0', 10),
            pj.microformat?.playerMicroformatRenderer?.publishDate || null,
            'HTML scrape'
          );
        }
      }
    }
  } catch (e) {
    console.warn(tag, 'HTML scrape failed:', e instanceof Error ? e.message : e);
  }

  throw new Error(`All transcript approaches failed for ${videoId}`);
}

/**
 * Extract video ID from various YouTube URL formats
 */
export function extractVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : url.length === 11 ? url : null;
}
