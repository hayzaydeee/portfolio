import type { Metadata } from "next";
import { Fresca, EB_Garamond, Texturina } from "next/font/google";
import "./globals.css";

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
};

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
      <body className="min-h-full">{children}</body>
    </html>
  );
}
