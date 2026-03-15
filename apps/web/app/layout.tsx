import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "코스피 스윙 시그널 알림기",
  description: "초보 부업 스윙 투자자를 위한 설명형 시그널 대시보드",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
