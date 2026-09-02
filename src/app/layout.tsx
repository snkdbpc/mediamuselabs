import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Media Muse Labs - Smart Visual Clustering & Multi-Platform Post Creation',
  description:
    'Organize visual albums, cluster images intelligently, and generate multi-platform social media posts for Facebook, Instagram, and Twitter. Powered by AI.',
  keywords: ['Media Muse Labs', 'Media Muse', 'AI Clustering', 'Social Media Generator', 'Visual Storytelling', 'Powered by AI'],
  icons: {
    icon: '/mediamuselabs_logo.png',
    apple: '/mediamuselabs_logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#0B0F19] text-slate-100 font-sans">
        {children}
      </body>
    </html>
  );
}
