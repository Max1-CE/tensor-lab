// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Макс
import katex from "katex";
import { memo, useMemo } from "react";

export const Tex = memo(function Tex({ tex, display = false }: { tex: string; display?: boolean }) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: "ignore" }),
    [tex, display],
  );
  return <span className={display ? "tex tex-display" : "tex"} dangerouslySetInnerHTML={{ __html: html }} />;
});

/** Text with $inline$ and $$display$$ math. */
export const RichText = memo(function RichText({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g).filter(Boolean), [text]);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("$$") ? (
          <Tex key={i} tex={p.slice(2, -2)} display />
        ) : p.startsWith("$") ? (
          <Tex key={i} tex={p.slice(1, -1)} />
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
});
