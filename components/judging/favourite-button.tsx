"use client";

import { useState } from "react";

export default function FavouriteButton() {
  const [active, setActive] = useState(false);

  return (
    <button
      type="button"
      aria-label={active ? "Remove from favourites" : "Mark as favourite"}
      onClick={() => setActive((v) => !v)}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "0.1rem 0.2rem",
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={active ? "#C9A84C" : "none"}
        stroke={active ? "#C9A84C" : "rgba(201,168,76,0.55)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </button>
  );
}
