import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sondhani DDC Lab Report System',
    short_name: 'Sondhani Lab',
    description: 'Offline-first medical lab report system for Sondhani Group',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable'
      }
    ]
  }
}
