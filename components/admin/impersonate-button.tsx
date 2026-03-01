"use client";

import { useState } from "react";
import styles from "./impersonate-button.module.css";

interface Props {
  targetUserId: string;
  orgName: string;
}

export default function ImpersonateButton({ targetUserId }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleImpersonate() {
    setLoading(true);
    const res = await fetch("/api/superadmin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId }),
    });
    if (res.ok) {
      window.location.href = "/dashboard";
    } else {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? "Failed to start impersonation");
      setLoading(false);
    }
  }

  return (
    <button className={styles.btn} onClick={handleImpersonate} disabled={loading}>
      {loading ? "Starting…" : `View as admin`}
    </button>
  );
}
