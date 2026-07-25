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

const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://abrown1564.github.io/flexgov";

export const metadata: Metadata = {
  title: "FlexGov — Governance Observability",
  description:
    "See who really determined a governance outcome, how robust it is, and how it changes under different governance assumptions.",
  icons: {
    icon: "favicon.svg",
    shortcut: "favicon.svg",
  },
  openGraph: {
    title: "FlexGov — Governance Observability",
    description:
      "See who really determined a governance outcome, how robust it is, and how it changes under different governance assumptions.",
    images: [{ url: `${origin}/og.png`, width: 1536, height: 1024 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FlexGov — Governance Observability",
    description:
      "See who really determined a governance outcome, how robust it is, and how it changes under different governance assumptions.",
    images: [`${origin}/og.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
