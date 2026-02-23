"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import styles from "./login.module.css";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  async function onSubmit(data: LoginFormValues) {
    setAuthError(null);
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.ok) {
      router.push("/dashboard");
    } else {
      setAuthError("Invalid email or password");
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.bgGlow} />
      <div className={styles.bgRingOuter} />
      <div className={styles.bgRingInner} />

      <section className={styles.shell}>
        <div className={styles.brandBlock}>
          <p className={styles.kicker}>Adjudication Platform</p>
          <h1 className={styles.heading}>
            Sign in and
            <span> keep judging.</span>
          </h1>
          <p className={styles.copy}>
            Access event administration, chapter reviews, judge scoring, and final rankings in one place.
          </p>
        </div>

        <article className={styles.card}>
          <header className={styles.cardHeader}>
            <h2 className={styles.wordmark}>
              <span className={styles.wordStrong}>Adjudic</span>
              <span className={styles.wordLight}>arts</span>
            </h2>
            <p className={styles.subtitle}>Sign in to your account</p>
          </header>

          <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
            <div className={styles.field}>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
                className={styles.input}
              />
              {errors.email && (
                <p className={styles.error}>{errors.email.message}</p>
              )}
            </div>

            <div className={styles.field}>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
                className={styles.input}
              />
              {errors.password && (
                <p className={styles.error}>{errors.password.message}</p>
              )}
            </div>

            {authError && <p className={styles.error}>{authError}</p>}

            <Button type="submit" className={styles.submit} disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </article>
      </section>
    </main>
  );
}
