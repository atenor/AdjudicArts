"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/roles";
import styles from "./invite-user-modal.module.css";

const INVITABLE_ROLES = [
  Role.ADMIN,
  Role.NATIONAL_CHAIR,
  Role.CHAPTER_CHAIR,
  Role.NATIONAL_JUDGE,
  Role.CHAPTER_JUDGE,
] as const;

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  role: z.nativeEnum(Role),
  name: z.string().optional(),
});

type FormValues = z.infer<typeof inviteSchema>;

interface Props {
  onSuccess?: () => void;
}

export default function InviteUserModal({ onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: Role.CHAPTER_JUDGE },
  });

  async function onSubmit(data: FormValues) {
    setServerError(null);
    const res = await fetch("/api/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setServerError(json.error ?? "Something went wrong");
      return;
    }
    setSent(data.email);
    onSuccess?.();
  }

  function handleClose() {
    setOpen(false);
    setSent(null);
    setServerError(null);
    reset();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className={styles.trigger}>Invite user</button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>Invite a team member</Dialog.Title>

          {sent ? (
            <div className={styles.successState}>
              <p className={styles.successMsg}>Invite sent to <strong>{sent}</strong></p>
              <p className={styles.successSub}>They&apos;ll receive an email with a link to set up their account.</p>
              <button className={styles.closeBtn} onClick={handleClose}>
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="inv-email">
                  Email address
                </label>
                <input
                  id="inv-email"
                  type="email"
                  className={styles.input}
                  placeholder="name@example.com"
                  {...register("email")}
                />
                {errors.email && <p className={styles.error}>{errors.email.message}</p>}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="inv-role">
                  Role
                </label>
                <select id="inv-role" className={styles.select} {...register("role")}>
                  {INVITABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r] ?? r}
                    </option>
                  ))}
                </select>
                {errors.role && <p className={styles.error}>{errors.role.message}</p>}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="inv-name">
                  Name <span className={styles.optional}>(optional — pre-fills their form)</span>
                </label>
                <input
                  id="inv-name"
                  className={styles.input}
                  placeholder="Their full name"
                  {...register("name")}
                />
              </div>

              {serverError && <p className={styles.error}>{serverError}</p>}

              <div className={styles.actions}>
                <Dialog.Close asChild>
                  <button type="button" className={styles.cancelBtn} onClick={handleClose}>
                    Cancel
                  </button>
                </Dialog.Close>
                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                  {isSubmitting ? "Sending…" : "Send invite"}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
