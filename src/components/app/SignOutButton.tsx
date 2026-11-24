import { LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="flex h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink lg:h-10">
        <LogOut aria-hidden className="size-[18px]" strokeWidth={1.75} />
        Se déconnecter
      </button>
    </form>
  );
}
