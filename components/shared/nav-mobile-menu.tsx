"use client";

import { useState } from "react";
import Link from "next/link";
import SignOutButton from "@/components/shared/sign-out-button";
import styles from "./nav-header.module.css";

type NavLink = {
  href: string;
  label: string;
};

export default function NavMobileMenu({
  mobileLinks,
}: {
  mobileLinks: NavLink[];
}) {
  const [open, setOpen] = useState(false);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className={styles.mobileMenu}>
      <button
        type="button"
        className={styles.mobileMenuButton}
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        ☰
      </button>
      {open ? (
        <nav className={styles.mobileMenuPanel} aria-label="Mobile dashboard navigation">
          {mobileLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={styles.mobileMenuLink}
              onClick={closeMenu}
            >
              <span>{link.label}</span>
            </Link>
          ))}
          <SignOutButton className={styles.mobileMenuSignOut} />
        </nav>
      ) : null}
    </div>
  );
}
