import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Imweb Master DB Admin',
  description: 'Imweb 상품 마스터 DB 관리 도구',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background text-foreground font-sans">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <header className="mb-8 flex flex-col gap-2 border-b pb-4">
            <h1 className="text-2xl font-semibold">Imweb Master DB Admin</h1>
            <p className="text-sm text-muted-foreground">상품 등록 및 수정을 위한 내부용 도구</p>
          </header>
          <main>{children}</main>
        </div>
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
