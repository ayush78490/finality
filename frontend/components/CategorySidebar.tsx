"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const CATEGORIES = [
  "Crypto",
  "Sports",
  "Esports",
  "Politics",
  "Tech",
  "Finance",
  "Economy",
  "Culture"
];

export function CategorySidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedTopic, setSelectedTopic] = useState("crypto");

  useEffect(() => {
    const topic = searchParams.get("topic") ?? "crypto";
    setSelectedTopic(topic.toLowerCase());
  }, [searchParams]);

  const onCategoryClick = (category: string) => {
    const next = category.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    params.set("topic", next);
    router.push(`/markets?${params.toString()}`);
  };

  return (
    <aside className="sticky top-[73px] h-[calc(100vh-73px)] w-[200px] shrink-0 border-r border-[#1a2530] bg-ink py-4">
      <div className="flex flex-col gap-1 px-3">
        <h3 className="px-3 pb-3 text-xs font-semibold uppercase tracking-wider text-mist">
          Categories
        </h3>
        {CATEGORIES.map((category) => {
          const isActive = selectedTopic === category.toLowerCase();
          return (
            <button
              key={category}
              onClick={() => onCategoryClick(category)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                isActive
                  ? "bg-panel text-white"
                  : "text-mist hover:bg-panel hover:text-white"
              }`}
            >
              {isActive && (
                <div className="h-1.5 w-1.5 rounded-full bg-shore" />
              )}
              {category}
            </button>
          );
        })}
      </div>
    </aside>
  );
}