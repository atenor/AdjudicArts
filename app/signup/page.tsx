"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import styles from "./signup.module.css";

const signupSchema = z
  .object({
    orgName: z.string().min(2, "Organization name must be at least 2 characters"),
    adminName: z.string().min(2, "Your name must be at least 2 characters"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(data: FormValues) {
    setServerError(null);
    const res = await fetch("/api/org/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgName: data.orgName,
        adminName: data.adminName,
        email: data.email,
        password: data.password,
      }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setServerError(json.error ?? "Something went wrong. Please try again.");
      return;
    }

    // Auto sign in after account creation
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.ok) {
      router.push("/dashboard");
    } else {
      router.push("/login");
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
          <p className={styles.subtitle}>Create your organization</p>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="orgName">
              Organization name
            </label>
            <input
              id="orgName"
              className={styles.input}
              placeholder="e.g. Pacific Arts Council"
              {...register("orgName")}
            />
            {errors.orgName && <p className={styles.error}>{errors.orgName.message}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="adminName">
              Your name
            </label>
            <input
              id="adminName"
              className={styles.input}
              placeholder="Your full name"
              {...register("adminName")}
            />
            {errors.adminName && <p className={styles.error}>{errors.adminName.message}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={styles.input}
              {...register("email")}
            />
            {errors.email && <p className={styles.error}>{errors.email.message}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Password
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

          {serverError && <p className={styles.error}>{serverError}</p>}

          <button type="submit" className={styles.submit} disabled={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className={styles.footer}>
          Already have an account?{" "}
          <Link href="/login" className={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
