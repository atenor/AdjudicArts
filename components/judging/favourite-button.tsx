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
        border: "none",
        cursor: "pointer",
        padding: "0.18rem 0.3rem",
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        boxShadow: active
          ? "0 0 0 1px rgba(201,168,76,0.4), 0 2px 10px rgba(201,168,76,0.22)"
          : "0 0 0 1px rgba(201,168,76,0.24)",
        background: active ? "rgba(201,168,76,0.14)" : "rgba(201,168,76,0.06)",
        transition: "all 160ms ease",
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill={active ? "#E0C070" : "none"}
        stroke={active ? "#C9A84C" : "rgba(201,168,76,0.9)"}
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
