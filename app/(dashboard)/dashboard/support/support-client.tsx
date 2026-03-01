"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import styles from "./support.module.css";

const ticketSchema = z.object({
  subject: z.string().min(3, "Subject must be at least 3 characters"),
  body: z.string().min(10, "Please provide more detail"),
});

type FormValues = z.infer<typeof ticketSchema>;

interface Ticket {
  id: string;
  subject: string;
  status: string;
  createdAt: Date | string;
  _count: { messages: number };
}

interface Props {
  initialTickets: Ticket[];
}

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export default function SupportClient({ initialTickets }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(ticketSchema) });

  async function onSubmit(data: FormValues) {
    setServerError(null);
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setServerError(json.error ?? "Something went wrong");
      return;
    }
    setSubmitted(true);
    reset();
    setShowForm(false);
    // Refresh ticket list
    const listRes = await fetch("/api/support");
    if (listRes.ok) {
      const { tickets: fresh } = await listRes.json();
      setTickets(fresh);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Support</h1>
          <p className={styles.sub}>Contact the AdjudicArts team</p>
        </div>
        {!showForm && (
          <button className={styles.newBtn} onClick={() => setShowForm(true)}>
            New ticket
          </button>
        )}
      </div>

      {submitted && (
        <div className={styles.successBanner}>
          Your ticket has been submitted. Our team will respond within 1 business day.
        </div>
      )}

      {showForm && (
        <section className={styles.formCard}>
          <h2 className={styles.formTitle}>New support ticket</h2>
          <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="subject">Subject</label>
              <input id="subject" className={styles.input} {...register("subject")} placeholder="Brief description of your issue" />
              {errors.subject && <p className={styles.error}>{errors.subject.message}</p>}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="body">Details</label>
              <textarea id="body" className={styles.textarea} rows={5} {...register("body")} placeholder="Describe what you need help with…" />
              {errors.body && <p className={styles.error}>{errors.body.message}</p>}
            </div>
            {serverError && <p className={styles.error}>{serverError}</p>}
            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                {isSubmitting ? "Submitting…" : "Submit ticket"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Your tickets</h2>
        {tickets.length === 0 ? (
          <p className={styles.empty}>No tickets yet. Use the button above to contact support.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Subject</th><th>Status</th><th>Replies</th><th>Created</th></tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td className={styles.subjectCell}>{t.subject}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[`status_${t.status}`]}`}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </td>
                    <td className={styles.dimCell}>{t._count.messages}</td>
                    <td className={styles.dimCell}>
                      {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
