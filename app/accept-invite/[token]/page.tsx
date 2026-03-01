"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ROLE_LABELS } from "@/lib/roles";
import { Role } from "@prisma/client";
import styles from "./accept-invite.module.css";

const formSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof formSchema>;

interface InviteInfo {
  email: string;
  role: Role;
  name: string | null;
}

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  useEffect(() => {
    fetch(`/api/users/invite/lookup?token=${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setLoadError(json.error ?? "This invite link is invalid or has expired.");
          return;
        }
        const data = await res.json();
        setInvite(data);
      })
      .catch(() => setLoadError("Failed to load invite. Please check your link and try again."))
      .finally(() => setLoading(false));
  }, [token]);

  async function onSubmit(data: FormValues) {
    setSubmitError(null);
    const res = await fetch("/api/users/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name: data.name, password: data.password }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setSubmitError(json.error ?? "Something went wrong. Please try again.");
      return;
    }

    // Sign in with new credentials
    const result = await signIn("credentials", {
      email: invite!.email,
      password: data.password,
      redirect: false,
    });

    if (result?.ok) {
      router.push("/dashboard");
    } else {
      router.push("/login?invited=1");
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.bgGlow} />
      <div className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.wordmark}>
            <span className={styles.wordStrong}>Adjudic</span>
            <span className={styles.wordLight}>arts</span>
          </h1>
        </header>

        {loading && <p className={styles.state}>Loading invite…</p>}

        {!loading && loadError && (
          <div className={styles.errorState}>
            <p className={styles.errorTitle}>Invite link invalid</p>
            <p className={styles.errorMsg}>{loadError}</p>
          </div>
        )}

        {!loading && invite && (
          <>
            <div className={styles.inviteInfo}>
              <p className={styles.roleChip}>
                {ROLE_LABELS[invite.role] ?? invite.role}
              </p>
              <p className={styles.inviteEmail}>{invite.email}</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="name">
                  Your name
                </label>
                <input
                  id="name"
                  className={styles.input}
                  defaultValue={invite.name ?? ""}
                  {...register("name")}
                />
                {errors.name && <p className={styles.error}>{errors.name.message}</p>}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="password">
                  Choose a password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  className={styles.input}
                  {...register("password")}
                />
                {errors.password && <p className={styles.error}>{errors.password.message}</p>}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="confirmPassword">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className={styles.input}
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword && (
                  <p className={styles.error}>{errors.confirmPassword.message}</p>
                )}
              </div>

              {submitError && <p className={styles.error}>{submitError}</p>}

              <button type="submit" className={styles.submit} disabled={isSubmitting}>
                {isSubmitting ? "Setting up account…" : "Create account"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
