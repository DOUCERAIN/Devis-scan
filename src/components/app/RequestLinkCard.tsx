"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Lien public de demande de devis de l'entreprise, à copier ou ouvrir. */
export function RequestLinkCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const input = document.getElementById("request-link") as HTMLInputElement | null;
      input?.select();
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="request-link" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Lien de demande de devis"
          className="h-10 min-w-0 flex-1 rounded-md border border-border-input bg-canvas px-3 font-mono text-sm text-ink" />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={copy} className="flex-1 sm:flex-none">
            {copied ? <><Check aria-hidden />Lien copié</> : <><Copy aria-hidden />Copier</>}
          </Button>
          <a href={url} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-brand hover:bg-brand-soft">
            <ExternalLink aria-hidden className="size-[18px]" />Ouvrir
          </a>
        </div>
      </div>
      <p className="text-xs text-ink-muted">Ajoutez ce lien sur votre site, dans vos e-mails ou envoyez-le par SMS : vos clients y décrivent leur déménagement et filment leurs pièces, sans créer de compte.</p>
    </div>
  );
}
