import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CV Transformer Agent — PDF/Image → Word/PowerPoint + Scoring IA",
  description: "Agent IA propulsé par NVIDIA Nemotron qui transforme votre CV (PDF ou image) en document Word ou PowerPoint professionnel et l'évalue avec un score détaillé sur 7 critères.",
  keywords: ["CV", "resume", "NVIDIA", "Nemotron", "Word", "PowerPoint", "IA", "scoring", "PDF", "extraction"],
  authors: [{ name: "CV Transformer Agent" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "CV Transformer Agent",
    description: "Transformez votre CV en Word/PowerPoint et obtenez un score IA",
    url: "https://chat.z.ai",
    siteName: "CV Transformer Agent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CV Transformer Agent",
    description: "Transformez votre CV en Word/PowerPoint et obtenez un score IA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
