"use client";

type Props = {
  title?: string;
  content?: string | null;
  defaultOpen?: boolean;
};

export default function RawDetails({
  title = "Raw",
  content,
  defaultOpen = false,
}: Props) {
  if (process.env.NODE_ENV === "production") return null;
  if (!content) return null;

  return (
    <details open={defaultOpen} className="my-4">
      <summary className="cursor-pointer flex items-center gap-2">
        <span className="chevron">▸</span>
        <span className="text-teal-800">{title}</span>
      </summary>
      <pre className="bg-gray-100 p-3 rounded mt-2 overflow-auto max-h-96">
        {content}
      </pre>
    </details>
  );
}
