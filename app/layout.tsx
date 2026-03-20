import type { Metadata, Viewport } from "next";
import "./globals.css";
import { EventProvider } from '@/components/EventProvider';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Jarvis Company Board",
  description: "멀티 에이전트 내부 게시판",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col"><EventProvider>{children}</EventProvider></body>
    </html>
  );
}
