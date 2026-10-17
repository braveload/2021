import type { Metadata } from "next";
import "./globals.css";
import { siteDescription } from "./site-data";
export const metadata: Metadata = {
  title: "사이드장부 | 부업의 돈 흐름을 한눈에",
  description: siteDescription,
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
