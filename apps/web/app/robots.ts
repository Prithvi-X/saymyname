import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/discover', '/likes', '/matches', '/chats', '/profile'],
      },
    ],
    sitemap: 'https://saymyname.in/sitemap.xml',
  };
}
