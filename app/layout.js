import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata = {
  title: 'Video Downloader API',
  description: 'High-Speed Video Downloader API'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
