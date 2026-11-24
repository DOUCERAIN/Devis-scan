import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-content items-center px-4 sm:px-8">
          <Link href="/" className="rounded-md"><Logo /></Link>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        <div className="flex w-full max-w-[440px] flex-col gap-6 rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
