"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Presentation only: never remounts page children or touches operational state.
export function ProductMotion() {
  const pathname = usePathname();
  const progress = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const animations: Animation[] = [];
    const observe = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        if (!preference.matches) animations.push(entry.target.animate(
          [{ opacity: 0.35, transform: "translateY(24px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 650, easing: "cubic-bezier(.2,.7,.2,1)" },
        ));
        observe.unobserve(entry.target);
      }
    }, { threshold: 0.12 });
    const connect = () => {
      const shell = document.querySelector(".dashboard-main, .landing-premium");
      if (!shell) return;
      document.querySelectorAll(".landing-premium main > section:not(.premium-hero), .premium-journey article").forEach(element => observe.observe(element));
      const main = document.querySelector(".dashboard-main");
      if (main && !preference.matches) animations.push(main.animate(
        [{ opacity: 0.65, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
        { duration: 280, easing: "ease-out" },
      ));
      pending.disconnect();
    };
    // A streamed route can commit its loading fallback before its page shell.
    const pending = new MutationObserver(connect);
    pending.observe(document.body, { childList: true, subtree: true });
    connect();
    let frame = 0;
    const update = () => {
      frame = 0;
      const distance = document.documentElement.scrollHeight - innerHeight;
      if (progress.current) progress.current.style.transform = `scaleX(${distance > 0 ? Math.min(1, scrollY / distance) : 0})`;
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    const cancel = () => { if (preference.matches) animations.forEach(animation => animation.cancel()); };
    update();
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll);
    preference.addEventListener("change", cancel);
    return () => { pending.disconnect(); observe.disconnect(); animations.forEach(animation => animation.cancel()); cancelAnimationFrame(frame); window.removeEventListener("scroll", scroll); window.removeEventListener("resize", scroll); preference.removeEventListener("change", cancel); };
  }, [pathname]);

  return <div ref={progress} className="reading-progress" aria-hidden="true" />;
}
