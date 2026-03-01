"use client";

import styles from "./sa-sign-out-button.module.css";

export default function SASignOutButton() {
  async function handleSignOut() {
    await fetch("/api/superadmin/auth", { method: "DELETE" });
    window.location.href = "/superadmin/login";
  }

  return (
    <button type="button" className={styles.btn} onClick={handleSignOut}>
      Sign out
    </button>
  );
}
