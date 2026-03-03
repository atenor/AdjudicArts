"use client";

type LocalDateTimeProps = {
  value: string | Date | null | undefined;
  fallback?: string;
};

export default function LocalDateTime({
  value,
  fallback = "--",
}: LocalDateTimeProps) {
  if (!value) return <>{fallback}</>;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return <>{fallback}</>;

  return (
    <time dateTime={date.toISOString()}>
      {date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}
    </time>
  );
}
