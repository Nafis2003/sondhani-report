import { ImageResponse } from 'next/og';
import { Droplet } from 'lucide-react';

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: { size: string } }
) {
  const size = parseInt(params.size, 10) || 192;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'white',
          borderRadius: size * 0.22,
        }}
      >
        <Droplet color="#e11d48" size={size * 0.6} strokeWidth={2.5} />
      </div>
    ),
    {
      width: size,
      height: size,
    }
  );
}
