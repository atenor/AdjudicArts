"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./ticket.module.css";

interface Message {
  id: string;
  body: string;
  fromSA: boolean;
  createdAt: Date | string;
}

interface Ticket {
  id: string;
  subject: string;
  body: string;
  status: string;
  organization: { id: string; name: string };
  submittedBy: { name: string; email: string };
  messages: Message[];
  createdAt: Date | string;
}

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export default function SATicketClient({ ticket: initial }: { ticket: Ticket }) {
  const [ticket, setTicket] = useState(initial);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  async function sendReply() {
    if (!reply.trim()) return;
    setSending(true);
    const res = await fetch(`/api/superadmin/support/${ticket.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply }),
    });
    if (res.ok) {
      setReply("");
      // Refresh
      const fresh = await fetch(`/api/superadmin/support/${ticket.id}`);
      if (fresh.ok) setTicket((await fresh.json()).ticket);
    }
    setSending(false);
  }

  async function updateStatus(status: string) {
    setUpdatingStatus(true);
    const res = await fetch(`/api/superadmin/support/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const { ticket: updated } = await res.json();
      setTicket((prev) => ({ ...prev, status: updated.status }));
    }
    setUpdatingStatus(false);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.ticketHeader}>
        <div>
          <h1 className={styles.subject}>{ticket.subject}</h1>
          <p className={styles.meta}>
            <Link href={`/superadmin/orgs/${ticket.organization.id}`} className={styles.orgLink}>
              {ticket.organization.name}
            </Link>
            {" · "}
            {ticket.submittedBy.name} ({ticket.submittedBy.email})
            {" · "}
            {new Date(ticket.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className={styles.statusRow}>
          <span className={`${styles.badge} ${styles[`status_${ticket.status}`]}`}>
            {STATUS_LABEL[ticket.status] ?? ticket.status}
          </span>
          <select
            className={styles.statusSelect}
            value={ticket.status}
            onChange={(e) => updateStatus(e.target.value)}
            disabled={updatingStatus}
          >
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      <div className={styles.thread}>
        {/* Original body */}
        <div className={`${styles.message} ${styles.messageOrg}`}>
          <p className={styles.messageAuthor}>{ticket.submittedBy.name}</p>
          <p className={styles.messageBody}>{ticket.body}</p>
          <p className={styles.messageTime}>
            {new Date(ticket.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
        </div>

        {ticket.messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.message} ${msg.fromSA ? styles.messageSA : styles.messageOrg}`}
          >
            <p className={styles.messageAuthor}>{msg.fromSA ? "AdjudicArts Support" : ticket.submittedBy.name}</p>
            <p className={styles.messageBody}>{msg.body}</p>
            <p className={styles.messageTime}>
              {new Date(msg.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
        ))}
      </div>

      <div className={styles.replyArea}>
        <textarea
          className={styles.replyInput}
          rows={4}
          placeholder="Type your reply…"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
        />
        <button className={styles.replyBtn} onClick={sendReply} disabled={sending || !reply.trim()}>
          {sending ? "Sending…" : "Send reply"}
        </button>
      </div>
    </div>
  );
}
