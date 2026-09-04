import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { clientConfig } from "@/lib/client-config";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });
export const metadata: Metadata = {
  title: "MH OP · Mobile Gaming One Stop Service",
  description:
    "Authentic mobile gadgets and PUBG Mobile accounts from official store-direct sources",
  authors: [{ name: clientConfig.developer.name }],
  creator: clientConfig.developer.name,
  publisher: clientConfig.developer.name,
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${space.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
