import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Motion Extraction - Extract Motion from Videos",
  description: "Advanced video processing tool that extracts motion from videos using frame offset technique. Upload your video and discover hidden motion patterns.",
  keywords: ["video processing", "motion extraction", "frame offset", "video analysis", "motion detection"],
  authors: [{ name: "Motion Extraction" }],
  creator: "Motion Extraction",
  metadataBase: new URL("https://motion-extraction.vercel.app"),
  openGraph: {
    title: "Motion Extraction - Extract Motion from Videos",
    description: "Advanced video processing tool that extracts motion from videos using frame offset technique. Upload your video and discover hidden motion patterns.",
    url: "https://motion-extraction.vercel.app",
    siteName: "Motion Extraction",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Motion Extraction - Video Processing Tool",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Motion Extraction - Extract Motion from Videos",
    description: "Advanced video processing tool that extracts motion from videos using frame offset technique.",
    images: ["/og-image.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.svg", sizes: "180x180", type: "image/svg+xml" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#111827" />
        <meta name="msapplication-TileColor" content="#111827" />
        <link rel="icon" type="image/svg+xml" href="/favicon.ico" />
        <link rel="icon" type="image/svg+xml" href="/icon-192.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
