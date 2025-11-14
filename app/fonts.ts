import { Dancing_Script, Geist, Geist_Mono } from "next/font/google";

export const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const handwritten = Dancing_Script({
  variable: "--font-handwritten",
  subsets: ["latin"],
  weight: ["400", "700"],
});
