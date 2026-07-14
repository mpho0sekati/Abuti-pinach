import { useState, useEffect, useRef, useCallback } from "react";

const FONT = "'SF Pro Text', -apple-system, system-ui, sans-serif";

export interface Product {
  name: string;
  store: string;
  price: string;
  url?: string;
  tag?: string;
  image_url?: string;
  distance?: string;
}

interface ProductCarouselProps {
  products: Product[];
  onDismiss: () => void;
}

const ProductCarousel = ({ products, onDismiss }: ProductCarouselProps) => {
  const [visible, setVisible] = useState(false);
  const [checkedIdx, setCheckedIdx] = useState<number | null>(null);
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    timerRef.current = setTimeout(() => dismiss(), 25000);
    return () => {
      cancelAnimationFrame(raf);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(onDismiss, 600);
  }, [onDismiss]);

  const handleCheck = (idx: number, url?: string) => {
    setCheckedIdx(idx);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (url) setTimeout(() => window.open(url, "_blank", "noopener"), 400);
    setTimeout(dismiss, 1400);
  };

  const handleImgError = (idx: number) => {
    setImgErrors(prev => new Set(prev).add(idx));
  };

  const tagColor = (tag?: string) => {
    if (!tag) return { bg: "hsla(130, 30%, 50%, 0.12)", text: "hsl(130, 35%, 38%)" };
    const t = tag.toLowerCase();
    if (t.includes("budget") || t.includes("co-op")) return { bg: "hsla(130, 40%, 48%, 0.15)", text: "hsl(130, 40%, 35%)" };
    if (t.includes("best")) return { bg: "hsla(45, 80%, 50%, 0.18)", text: "hsl(35, 60%, 35%)" };
    if (t.includes("premium")) return { bg: "hsla(260, 40%, 55%, 0.12)", text: "hsl(260, 30%, 40%)" };
    if (t.includes("nearest") || t.includes("near")) return { bg: "hsla(200, 50%, 50%, 0.15)", text: "hsl(200, 40%, 35%)" };
    return { bg: "hsla(200, 30%, 50%, 0.12)", text: "hsl(200, 30%, 38%)" };
  };

  // Sort: nearest first
  const sorted = [...products].sort((a, b) => {
    if (a.distance?.toLowerCase() === "nearest") return -1;
    if (b.distance?.toLowerCase() === "nearest") return 1;
    const da = parseFloat(a.distance || "999");
    const db = parseFloat(b.distance || "999");
    return da - db;
  });

  const productInitial = (name: string) => {
    return name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 380,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(18px) scale(0.92)",
        filter: visible ? "blur(0px)" : "blur(4px)",
        transition: "opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), filter 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {/* Dismiss handle */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
        <button
          onClick={dismiss}
          style={{
            width: 32, height: 4, borderRadius: 2,
            background: "hsla(0, 0%, 0%, 0.1)",
            border: "none", cursor: "pointer",
            transition: "background 0.2s ease",
          }}
          aria-label="Dismiss"
        />
      </div>

      {/* Scrollable cards */}
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          overflowY: "hidden",
          paddingBottom: 4,
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          msOverflowStyle: "none",
          scrollbarWidth: "none",
        }}
      >
        {sorted.map((p, i) => {
          const tc = tagColor(p.tag);
          const isChecked = checkedIdx === i;
          const hasImage = p.image_url && !imgErrors.has(i);
          const isNearest = p.distance?.toLowerCase() === "nearest" || p.distance?.includes("km") && parseFloat(p.distance) <= 5;

          return (
            <div
              key={i}
              onClick={() => handleCheck(i, p.url)}
              style={{
                flex: "0 0 auto",
                width: 168,
                scrollSnapAlign: "start",
                borderRadius: 22,
                cursor: "pointer",
                position: "relative",
                overflow: "hidden",
                background: isChecked
                  ? "hsla(130, 35%, 48%, 0.12)"
                  : "hsla(0, 0%, 100%, 0.55)",
                backdropFilter: "blur(40px) saturate(1.8)",
                WebkitBackdropFilter: "blur(40px) saturate(1.8)",
                border: isChecked
                  ? "1.5px solid hsla(130, 40%, 48%, 0.4)"
                  : isNearest
                    ? "1.5px solid hsla(200, 45%, 55%, 0.3)"
                    : "1px solid hsla(0, 0%, 100%, 0.45)",
                boxShadow: `
                  0 6px 24px hsla(130, 20%, 30%, 0.07),
                  0 1px 4px hsla(0, 0%, 0%, 0.03),
                  inset 0 1px 0 hsla(0, 0%, 100%, 0.6)
                `,
                transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
                transform: isChecked ? "scale(0.96)" : "scale(1)",
                opacity: visible ? 1 : 0,
                animation: visible ? `cardSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.08}s both` : "none",
              }}
            >
              {/* Product image */}
              <div style={{
                width: "100%",
                height: 88,
                borderRadius: "22px 22px 0 0",
                overflow: "hidden",
                position: "relative",
                background: hasImage ? "hsl(0, 0%, 95%)" : `linear-gradient(135deg, hsla(130, 30%, 85%, 0.5), hsla(130, 20%, 75%, 0.3))`,
              }}>
                {hasImage ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    onError={() => handleImgError(i)}
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transition: "transform 0.4s ease",
                    }}
                  />
                ) : (
                  <div style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                    fontWeight: 700,
                    fontFamily: FONT,
                    color: "hsla(130, 30%, 45%, 0.35)",
                    letterSpacing: "0.04em",
                  }}>
                    {productInitial(p.name)}
                  </div>
                )}
                {/* Nearest badge overlay */}
                {isNearest && (
                  <div style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    padding: "3px 7px",
                    borderRadius: 8,
                    background: "hsla(200, 55%, 48%, 0.85)",
                    backdropFilter: "blur(8px)",
                    color: "white",
                    fontSize: 8.5,
                    fontWeight: 700,
                    fontFamily: FONT,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}>
                    Nearest
                  </div>
                )}
                {/* Gradient fade at bottom of image */}
                <div style={{
                  position: "absolute",
                  bottom: 0, left: 0, right: 0,
                  height: 24,
                  background: isChecked
                    ? "linear-gradient(transparent, hsla(130, 35%, 48%, 0.12))"
                    : "linear-gradient(transparent, hsla(0, 0%, 100%, 0.55))",
                  pointerEvents: "none",
                }} />
              </div>

              {/* Card content */}
              <div style={{ padding: "10px 14px 12px" }}>
                {/* Refractive light band */}
                <div style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0, bottom: 0,
                  borderRadius: 22,
                  pointerEvents: "none",
                  background: "linear-gradient(135deg, transparent 30%, hsla(160, 50%, 92%, 0.1) 50%, transparent 70%)",
                }} />

                {/* Tag + Distance row */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, position: "relative", zIndex: 1 }}>
                  {p.tag && (
                    <div style={{
                      display: "inline-block",
                      padding: "2px 7px",
                      borderRadius: 6,
                      background: tc.bg,
                      color: tc.text,
                      fontSize: 9,
                      fontWeight: 600,
                      fontFamily: FONT,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}>
                      {p.tag}
                    </div>
                  )}
                  {p.distance && p.distance.toLowerCase() !== "nearest" && (
                    <div style={{
                      fontSize: 9,
                      fontFamily: FONT,
                      color: "hsl(0, 0%, 55%)",
                      fontWeight: 500,
                    }}>
                      {p.distance}
                    </div>
                  )}
                </div>

                {/* Product name */}
                <div style={{
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: FONT,
                  color: "hsl(0, 0%, 15%)",
                  lineHeight: 1.3,
                  marginBottom: 3,
                  position: "relative",
                  zIndex: 1,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  overflowWrap: "break-word" as any,
                }}>
                  {p.name}
                </div>

                {/* Store */}
                <div style={{
                  fontSize: 10,
                  fontFamily: FONT,
                  color: "hsl(0, 0%, 48%)",
                  marginBottom: 8,
                  position: "relative",
                  zIndex: 1,
                }}>
                  {p.store}
                </div>

                {/* Price + check */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  position: "relative",
                  zIndex: 1,
                }}>
                  <span style={{
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: FONT,
                    color: "hsl(130, 35%, 35%)",
                    letterSpacing: "-0.02em",
                  }}>
                    {p.price}
                  </span>

                  <div style={{
                    width: 22, height: 22,
                    borderRadius: "50%",
                    border: isChecked ? "none" : "1.5px solid hsla(0, 0%, 0%, 0.1)",
                    background: isChecked
                      ? "linear-gradient(135deg, hsl(130, 40%, 48%), hsl(142, 38%, 42%))"
                      : "hsla(0, 0%, 100%, 0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                    transform: isChecked ? "scale(1.15)" : "scale(1)",
                  }}>
                    {isChecked && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scroll indicator dots */}
      {sorted.length > 2 && (
        <div style={{
          display: "flex",
          gap: 4,
          justifyContent: "center",
          marginTop: 8,
        }}>
          {sorted.map((_, i) => (
            <div key={i} style={{
              width: 4, height: 4, borderRadius: 2,
              background: `hsla(0, 0%, 0%, ${i === 0 ? 0.2 : 0.08})`,
              transition: "background 0.3s ease",
            }} />
          ))}
        </div>
      )}

      <style>{`
        div::-webkit-scrollbar { display: none; }
        @keyframes cardSlideIn {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default ProductCarousel;
