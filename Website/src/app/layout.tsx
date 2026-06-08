import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BLAID — AI enablement for small & medium businesses",
  description:
    "BLAID helps small and medium businesses become AI-enabled. Practical AI adoption, automation, and training — without the enterprise price tag.",
  openGraph: {
    title: "BLAID — AI enablement for small & medium businesses",
    description:
      "Practical AI adoption, automation, and training for SMBs. Results in weeks, not quarters.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
