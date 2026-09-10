import { brandAssets } from "@/lib/brand-assets";
import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { clientConfig } from "@/lib/client-config";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "MH OP · Mobile Gaming One Stop Service",
  description:
    "Authentic mobile gadgets and PUBG Mobile accounts from official store-direct sources",
  authors: [{ name: clientConfig.developer.name }],
  creator: clientConfig.developer.name,
  publisher: clientConfig.developer.name,
  icons: {
    icon: brandAssets.logo,
    shortcut: brandAssets.logo,
    apple: brandAssets.logo,
  },
  openGraph: {
    title: "MH OP · Mobile Gaming One Stop Service",
    description:
      "Authentic mobile gadgets and PUBG Mobile accounts from official store-direct sources",
    images: [
      {
        url: brandAssets.store,
        width: 1376,
        height: 768,
        alt: "MH OP Flagship Store",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MH OP · Mobile Gaming One Stop Service",
    description:
      "Authentic mobile gadgets and PUBG Mobile accounts from official store-direct sources",
    images: [brandAssets.store],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body
        className={`${inter.variable} ${space.variable}`}
        suppressHydrationWarning
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
