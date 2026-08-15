import type { LogEntry } from "../types/server";

export function parseRemoteLogs(output: string): LogEntry[] {
  return output
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      const match = line.match(/(\d{4}-\d{2}-\d{2}T\S+|\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
      const timestamp = match?.[1];
      const parsedTimestamp = timestamp ? new Date(timestamp) : null;
      const message = match?.index === undefined ? line : line.slice(match.index + timestamp!.length).trimStart();
      const normalized = message.toLowerCase();
      const level: LogEntry["level"] =
        normalized.includes("error") || normalized.includes("fatal")
          ? "error"
          : normalized.includes("warn")
            ? "warning"
            : normalized.includes("success") || normalized.includes("started")
              ? "success"
              : "info";
      return {
        id: `${index}-${line}`,
        timestamp: parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime())
          ? parsedTimestamp.toISOString()
          : new Date().toISOString(),
        level,
        source: "palworld-server",
        message,
      };
    });
}
