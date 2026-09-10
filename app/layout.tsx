import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '研间 · 个人科研工作台',
  description: '个人任务、科研项目和学生指导的本地工作台',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
