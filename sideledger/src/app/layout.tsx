import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "사이드장부 | 부업의 돈 흐름을 한눈에",
  description: "수입, 경비, 견적서와 청구서를 한 곳에서 관리하는 로컬 장부",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
