import type { Metadata } from "next";
import { Fresca, EB_Garamond, Texturina } from "next/font/google";
import "./globals.css";
import { AudioProvider } from "@/lib/audio/AudioContext";
import { PlayerBar } from "@/components/studio/PlayerBar";

const fresca = Fresca({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-fresca",
  display: "swap",
});

const garamond = EB_Garamond({
  weight: ["400", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-garamond",
  display: "swap",
});

const texturina = Texturina({
  weight: ["400"],
  style: ["normal"],
  subsets: ["latin"],
  variable: "--font-texturina",
  display: "swap",
});

export const metadata: Metadata = {
  title: "hayzaydee — Divine Eze",
  description: "Software engineer, musician, writer. A studio, not a portfolio.",
  metadataBase: new URL("https://hayzaydee.me"),
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    other: [
      { rel: "manifest", url: "/site.webmanifest" },
    ],
  },
};

// Google Sans Code is not in next/font/google — loaded via <link> in the <head>
const GOOGLE_SANS_CODE_URL =
  "https://fonts.googleapis.com/css2?family=Google+Sans+Code:wght@400;500&display=swap";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fresca.variable} ${garamond.variable} ${texturina.variable} h-full antialiased`}
    >
      <head>
        {/* Google Sans Code — not available in next/font/google */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={GOOGLE_SANS_CODE_URL} />
      </head>
      <body className="min-h-full flex flex-col">
        <AudioProvider>
          {children}
          <PlayerBar />
        </AudioProvider>
      </body>
    </html>
  );
}
