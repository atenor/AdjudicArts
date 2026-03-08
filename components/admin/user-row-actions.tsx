"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/roles";

const MANAGEABLE_ROLES: Role[] = [
  Role.ADMIN,
  Role.NATIONAL_CHAIR,
  Role.CHAPTER_CHAIR,
  Role.NATIONAL_JUDGE,
  Role.CHAPTER_JUDGE,
];

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  chapter: string | null;
};

interface UserRowActionsProps {
  user: ManagedUser;
  isChapterChair: boolean;
  chairChapter: string | null;
  canEditRole: boolean;
}

export default function UserRowActions({
  user,
  isChapterChair,
  chairChapter,
  canEditRole,
}: UserRowActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<Role>(user.role);
  const [chapter, setChapter] = useState(user.chapter ?? "");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const allowedRoles = useMemo(
    () => (isChapterChair ? [Role.CHAPTER_JUDGE] : MANAGEABLE_ROLES),
    [isChapterChair]
  );

  function openEdit() {
    setError(null);
    setSuccess(null);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setChapter(user.chapter ?? "");
    setEditOpen(true);
  }

  async function submitEdit() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const chapterValue = isChapterChair ? chairChapter ?? user.chapter ?? null : chapter.trim() || null;
      const payload = {
        name: name.trim(),
        email: email.trim(),
        role,
        chapter: chapterValue,
      };
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Unable to save changes");
        return;
      }
      setEditOpen(false);
      setSuccess("Profile updated.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function openReset() {
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(null);
    setResetOpen(true);
  }

  async function submitReset() {
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setResetting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Unable to reset password");
        return;
      }
      setResetOpen(false);
      setSuccess("Password reset saved.");
    } finally {
      setResetting(false);
    }
  }

  function openDelete() {
    setDeleteConfirm("");
    setError(null);
    setSuccess(null);
    setDeleteOpen(true);
  }

  async function submitDelete() {
    if (deleteConfirm.trim().toUpperCase() !== "DELETE") {
      setError('Type "DELETE" to confirm removal.');
      return;
    }

    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/users?userId=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Unable to remove user");
        return;
      }
      setDeleteOpen(false);
      setSuccess("User removed.");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openEdit}
          className="inline-flex h-8 items-center rounded-md border border-[#d8cce9] bg-white px-2.5 text-xs font-semibold text-[#4f26a8] hover:bg-[#f5efff]"
        >
          Edit profile
        </button>
        <button
          type="button"
          onClick={openReset}
          className="inline-flex h-8 items-center rounded-md border border-[#d8cce9] bg-white px-2.5 text-xs font-semibold text-[#4f26a8] hover:bg-[#f5efff]"
        >
          Reset password
        </button>
        <button
          type="button"
          onClick={openDelete}
          className="inline-flex h-8 items-center rounded-md border border-[#f1b2b2] bg-white px-2.5 text-xs font-semibold text-[#b42318] hover:bg-[#fff0f0]"
        >
          Delete user
        </button>
      </div>

      {success ? <p className="text-xs font-medium text-[#147a58]">{success}</p> : null}
      {error ? <p className="text-xs font-medium text-[#b42318]">{error}</p> : null}

      {editOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-xl border border-[#d8cce9] bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-[#1e1538]">Edit user profile</h3>
            <p className="mt-1 text-xs text-[#8b7ab5]">Update profile name, email, role, and chapter assignment.</p>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8b7ab5]">Profile name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-10 w-full rounded-md border border-[#d8cce9] px-3 text-sm text-[#1e1538] outline-none focus:border-[#8b7ab5]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8b7ab5]">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-10 w-full rounded-md border border-[#d8cce9] px-3 text-sm text-[#1e1538] outline-none focus:border-[#8b7ab5]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8b7ab5]">Role</span>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as Role)}
                  disabled={!canEditRole}
                  className="h-10 w-full rounded-md border border-[#d8cce9] bg-white px-3 text-sm text-[#1e1538] outline-none focus:border-[#8b7ab5] disabled:bg-[#f5f1fb] disabled:text-[#8b7ab5]"
                >
                  {allowedRoles.map((allowedRole) => (
                    <option key={allowedRole} value={allowedRole}>
                      {ROLE_LABELS[allowedRole] ?? allowedRole}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8b7ab5]">Chapter</span>
                <input
                  value={isChapterChair ? chairChapter ?? "" : chapter}
                  onChange={(event) => setChapter(event.target.value)}
                  disabled={isChapterChair}
                  className="h-10 w-full rounded-md border border-[#d8cce9] px-3 text-sm text-[#1e1538] outline-none focus:border-[#8b7ab5] disabled:bg-[#f5f1fb] disabled:text-[#8b7ab5]"
                  placeholder="Optional"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="inline-flex h-10 items-center rounded-md border border-[#d8cce9] px-4 text-sm font-semibold text-[#4f26a8] hover:bg-[#f5efff]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitEdit}
                disabled={saving}
                className="inline-flex h-10 items-center rounded-md bg-[#147a58] px-4 text-sm font-semibold text-white hover:bg-[#0d7b5f] disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {resetOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#d8cce9] bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-[#1e1538]">Reset password</h3>
            <p className="mt-1 text-xs text-[#8b7ab5]">Set a new password for this account.</p>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8b7ab5]">New password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-10 w-full rounded-md border border-[#d8cce9] px-3 text-sm text-[#1e1538] outline-none focus:border-[#8b7ab5]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8b7ab5]">Confirm password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-10 w-full rounded-md border border-[#d8cce9] px-3 text-sm text-[#1e1538] outline-none focus:border-[#8b7ab5]"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetOpen(false)}
                className="inline-flex h-10 items-center rounded-md border border-[#d8cce9] px-4 text-sm font-semibold text-[#4f26a8] hover:bg-[#f5efff]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReset}
                disabled={resetting}
                className="inline-flex h-10 items-center rounded-md bg-[#147a58] px-4 text-sm font-semibold text-white hover:bg-[#0d7b5f] disabled:opacity-60"
              >
                {resetting ? "Saving..." : "Save new password"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#f1b2b2] bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-[#1e1538]">Delete user</h3>
            <p className="mt-1 text-xs text-[#8b7ab5]">
              This removes <span className="font-semibold text-[#1e1538]">{user.name}</span> from the organization.
            </p>
            <p className="mt-2 text-xs text-[#b42318]">Type DELETE to confirm.</p>

            <div className="mt-3">
              <input
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                className="h-10 w-full rounded-md border border-[#f1b2b2] px-3 text-sm text-[#1e1538] outline-none focus:border-[#b42318]"
                placeholder="DELETE"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="inline-flex h-10 items-center rounded-md border border-[#d8cce9] px-4 text-sm font-semibold text-[#4f26a8] hover:bg-[#f5efff]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitDelete}
                disabled={deleting}
                className="inline-flex h-10 items-center rounded-md bg-[#b42318] px-4 text-sm font-semibold text-white hover:bg-[#951f16] disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete user"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
