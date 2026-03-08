"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/roles";
import styles from "./invite-user-modal.module.css";

const DEFAULT_ALLOWED_ROLES = [
  Role.ADMIN,
  Role.NATIONAL_CHAIR,
  Role.CHAPTER_CHAIR,
  Role.NATIONAL_JUDGE,
  Role.CHAPTER_JUDGE,
] as const;

interface ManualUserModalProps {
  triggerLabel?: string;
  title?: string;
  allowedRoles?: readonly Role[];
  fixedChapter?: string | null;
  helperText?: string;
}

export default function ManualUserModal({
  triggerLabel = "Add user manually",
  title = "Add user manually",
  allowedRoles = DEFAULT_ALLOWED_ROLES,
  fixedChapter = null,
  helperText,
}: ManualUserModalProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(allowedRoles[0] ?? Role.CHAPTER_JUDGE);
  const [chapter, setChapter] = useState(fixedChapter ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const chapterLocked = Boolean(fixedChapter);

  function resetForm() {
    setSaving(false);
    setServerError(null);
    setSuccessMessage(null);
    setName("");
    setEmail("");
    setRole(allowedRoles[0] ?? Role.CHAPTER_JUDGE);
    setChapter(fixedChapter ?? "");
    setPassword("");
    setConfirmPassword("");
  }

  function closeModal() {
    setOpen(false);
    resetForm();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    setSuccessMessage(null);
    const effectiveChapter = chapterLocked ? (fixedChapter ?? "") : chapter;

    if (!name.trim()) {
      setServerError("Profile name is required.");
      return;
    }
    if (!email.trim()) {
      setServerError("Email is required.");
      return;
    }
    if (password.length < 8) {
      setServerError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setServerError("Passwords do not match.");
      return;
    }
    if (role === Role.CHAPTER_JUDGE && !effectiveChapter.trim()) {
      setServerError("Chapter is required for chapter judge accounts.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/users/manual-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          role,
          chapter: effectiveChapter.trim() || null,
          password,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setServerError(payload.error ?? "Unable to create user");
        return;
      }

      setSuccessMessage("User created successfully.");
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className={styles.triggerSecondary}>{triggerLabel}</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>

          {helperText ? <p className={styles.optional}>{helperText}</p> : null}
          {successMessage ? (
            <div className={styles.successState}>
              <p className={styles.successMsg}>{successMessage}</p>
              <button type="button" className={styles.closeBtn} onClick={closeModal}>
                Done
              </button>
            </div>
          ) : (
            <form className={styles.form} onSubmit={onSubmit}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="manual-name">
                  Profile name
                </label>
                <input
                  id="manual-name"
                  className={styles.input}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="manual-email">
                  Email
                </label>
                <input
                  id="manual-email"
                  type="email"
                  className={styles.input}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="manual-role">
                  Role
                </label>
                <select
                  id="manual-role"
                  className={styles.select}
                  value={role}
                  onChange={(event) => setRole(event.target.value as Role)}
                >
                  {allowedRoles.map((allowedRole) => (
                    <option key={allowedRole} value={allowedRole}>
                      {ROLE_LABELS[allowedRole] ?? allowedRole}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="manual-chapter">
                  Chapter
                </label>
                <input
                  id="manual-chapter"
                  className={styles.input}
                  value={chapterLocked ? fixedChapter ?? "" : chapter}
                  onChange={(event) => setChapter(event.target.value)}
                  disabled={chapterLocked}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="manual-password">
                  Password
                </label>
                <input
                  id="manual-password"
                  type="password"
                  className={styles.input}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="manual-password-confirm">
                  Confirm password
                </label>
                <input
                  id="manual-password-confirm"
                  type="password"
                  className={styles.input}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>

              {serverError ? <p className={styles.error}>{serverError}</p> : null}

              <div className={styles.actions}>
                <Dialog.Close asChild>
                  <button type="button" className={styles.cancelBtn} onClick={closeModal}>
                    Cancel
                  </button>
                </Dialog.Close>
                <button type="submit" className={styles.submitBtn} disabled={saving}>
                  {saving ? "Creating..." : "Create user"}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
