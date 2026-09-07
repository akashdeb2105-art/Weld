import { ImageResponse } from 'next/og';
import { api, type PublicGame } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const alt = 'A game made with WELD';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Dynamic Open Graph card for a published game (M6 share cards).
 *
 * Honest by construction: the card renders only real, current data — the
 * game's actual title, genre, and summary pulled from the API — never a fake
 * screenshot or a canned marketing image. Unpublished/unknown games get a
 * plain WELD card (the page itself 404s anyway).
 */
export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let game: PublicGame | null = null;
  try {
    game = await api.getPublicGame(slug);
  } catch {
    game = null;
  }

  const title = game?.title ?? 'Made with WELD';
  const genre = game?.genre ?? '';
  const summary = game?.summary ?? 'Describe it. Build it. Break it. Ship it.';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: '#0b0d12',
          backgroundImage:
            'linear-gradient(to right, rgba(42,51,74,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(42,51,74,0.4) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          color: '#f2f0ea',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top row: wordmark + state */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 14,
                height: 14,
                background: '#ff5c1a',
              }}
            />
            <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: 2, color: '#f2f0ea' }}>
              WELD
            </span>
          </div>
          <span
            style={{
              fontSize: 20,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: '#41d98d',
              border: '1px solid rgba(65,217,141,0.4)',
              borderRadius: 6,
              padding: '6px 14px',
            }}
          >
            {game ? 'Published' : 'AI Game Studio'}
          </span>
        </div>

        {/* Middle: title + genre + summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {genre ? (
            <span
              style={{
                fontSize: 24,
                letterSpacing: 4,
                textTransform: 'uppercase',
                color: '#ff8a50',
              }}
            >
              {genre}
            </span>
          ) : null}
          <span style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.02, letterSpacing: -1 }}>
            {title}
          </span>
          <span style={{ fontSize: 32, lineHeight: 1.3, color: '#aab3c5', maxWidth: 900 }}>
            {summary.length > 120 ? `${summary.slice(0, 117)}...` : summary}
          </span>
        </div>

        {/* Bottom: honest tagline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ height: 2, flex: 1, background: 'linear-gradient(90deg, #ff5c1a, #ff8a50)' }} />
          <span style={{ fontSize: 22, letterSpacing: 4, textTransform: 'uppercase', color: '#6b7488' }}>
            Playtested before it shipped
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
