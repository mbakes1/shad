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
  title: {
    default: "SA Gov Tenders - South African Government Procurement Portal",
    template: "%s | SA Gov Tenders"
  },
  description: "Browse active procurement opportunities from South African government entities. Find tenders, RFPs, and procurement notices from OCDS API.",
  keywords: ["South Africa", "government", "tenders", "procurement", "OCDS", "opportunities", "RFP", "bids"],
  authors: [{ name: "SA Gov Tenders" }],
  creator: "SA Gov Tenders",
  publisher: "SA Gov Tenders",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  openGraph: {
    type: "website",
    locale: "en_ZA",
    url: "/",
    title: "SA Gov Tenders - South African Government Procurement Portal",
    description: "Browse active procurement opportunities from South African government entities. Find tenders, RFPs, and procurement notices from OCDS API.",
    siteName: "SA Gov Tenders",
  },
  twitter: {
    card: "summary_large_image",
    title: "SA Gov Tenders - South African Government Procurement Portal",
    description: "Browse active procurement opportunities from South African government entities. Find tenders, RFPs, and procurement notices from OCDS API.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
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
