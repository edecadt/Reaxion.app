"use client";

import { useState } from "react";

type AboutPayload = {
  client: { host: string };
  server: {
    current_time: number;
    services: Array<{
      name: string;
      actions: Array<{ name: string; description: string }>;
      reactions: Array<{ name: string; description: string }>;
    }>;
  };
};

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string>(
    "Click the button to fetch data.",
  );

  const fetchAbout = async () => {
    setIsLoading(true);
    setResponse("Loading...");

    try {
      const res = await fetch("http://localhost:8080/about.json");

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      const data: AboutPayload = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setResponse(`Request failed: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <main className="w-full max-w-2xl bg-white shadow-md rounded-lg p-8 space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">
            Action REAction Viewer
          </h1>
          <p className="text-slate-600 mt-1">
            Click the button to fetch the server description served by the Nest
            backend.
          </p>
        </header>

        <button
          type="button"
          onClick={fetchAbout}
          disabled={isLoading}
          className="px-5 py-3 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? "Loading..." : "Load /about.json"}
        </button>

        <pre className="bg-slate-900 text-slate-100 rounded-md p-4 overflow-x-auto text-sm leading-relaxed whitespace-pre-wrap">
          {response}
        </pre>
      </main>
    </div>
  );
}
