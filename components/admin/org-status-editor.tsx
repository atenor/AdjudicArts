"use client";

import { useState } from "react";
import styles from "./org-status-editor.module.css";

interface Props {
  orgId: string;
  currentPlan: string;
  currentStatus: string;
}

export default function OrgStatusEditor({ orgId, currentPlan, currentStatus }: Props) {
  const [plan, setPlan] = useState(currentPlan);
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/superadmin/orgs/${orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, status }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className={styles.row}>
      <div className={styles.field}>
        <label className={styles.label}>Plan</label>
        <select className={styles.select} value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="starter">Starter</option>
          <option value="regional">Regional</option>
          <option value="national">National</option>
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Status</label>
        <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : saved ? "Saved!" : "Save"}
      </button>
    </div>
  );
}
