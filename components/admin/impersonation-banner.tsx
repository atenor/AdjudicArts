"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./impersonation-banner.module.css";

interface Props {
  orgName: string;
}

export default function ImpersonationBanner({ orgName }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleExit() {
    setLoading(true);
    await fetch("/api/superadmin/impersonate", { method: "DELETE" });
    router.push("/superadmin");
  }

  return (
    <div className={styles.banner}>
      <span className={styles.label}>
        👁 Viewing as org: <strong>{orgName}</strong>
      </span>
      <button className={styles.exitBtn} onClick={handleExit} disabled={loading}>
        {loading ? "Exiting…" : "Exit impersonation"}
      </button>
    </div>
  );
}
