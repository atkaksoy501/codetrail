import { PROVIDER_METADATA, type Provider } from "@codetrail/core/browser";
import { useEffect, useMemo, useRef } from "react";

export type DeleteTarget =
  | {
      kind: "session";
      provider: Provider;
      title: string;
      path: string;
      messageCount: number;
    }
  | {
      kind: "project";
      provider: Provider;
      title: string;
      path: string;
      sessionCount: number;
      messageCount: number;
    };

export function DeleteIndexedHistoryDialog({
  open,
  target,
  errorMessage = null,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  target: DeleteTarget | null;
  errorMessage?: string | null;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const confirmedRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      confirmedRef.current = false;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (busy) {
        return;
      }
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      dialogRef.current?.close();
    };

    window.addEventListener("keydown", onWindowKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown, true);
    };
  }, [busy, open]);

  const content = useMemo(() => {
    if (!target) {
      return null;
    }

    const provider = PROVIDER_METADATA[target.provider];
    const isJsonl = provider.sourceFormat === "jsonl_stream";
    const title =
      target.kind === "session"
        ? "Delete Session From Code Trail?"
        : "Delete Project From Code Trail?";
    const confirmLabel = target.kind === "session" ? "Delete Session" : "Delete Project";
    const summaryStats =
      target.kind === "session"
        ? [`${target.messageCount} ${target.messageCount === 1 ? "message" : "messages"}`]
        : [
            `${target.sessionCount} ${target.sessionCount === 1 ? "session" : "sessions"}`,
            `${target.messageCount} ${target.messageCount === 1 ? "message" : "messages"}`,
          ];
    const deleteNow =
      target.kind === "session"
        ? "This removes the indexed session and any related bookmarks from Code Trail only. The raw transcript file on disk will not be changed."
        : "This removes the indexed project history, its sessions, and any related bookmarks from Code Trail only. Raw transcript files on disk will not be changed.";
    const futureBehavior = isJsonl
      ? [
          "Normal refresh will keep this deleted history suppressed.",
          "If the same JSONL transcript file only grows by appending new content, Code Trail will ingest only the new tail.",
          "If the file changes in a non-append-only way and still resolves to the same session identity, it will stay deleted and Code Trail will write a warning to the logs.",
          "If the file changes in a non-append-only way and resolves to a different session identity, Code Trail will ingest it as a new session and write a warning to the logs.",
          "Force Reindex will read the full file from disk again.",
        ]
      : [
          "This provider stores history as whole-file JSON, not append-resumable JSONL.",
          "Normal refresh will keep this deleted history suppressed.",
          "Code Trail will not restore partial changes from rewritten files during incremental refresh.",
          "Force Reindex will read the full file from disk again.",
        ];

    return {
      title,
      confirmLabel,
      providerLabel: provider.label,
      deleteNow,
      futureBehavior,
      summaryStats,
    };
  }, [target]);

  if (!target || !content) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog delete-history-dialog"
      onClose={() => {
        if (!confirmedRef.current && !busy) {
          onCancel();
        }
      }}
      onClick={(event) => {
        if (busy) {
          return;
        }
        if (event.target === dialogRef.current) {
          dialogRef.current?.close();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (busy) {
          return;
        }
        if (event.key === "Escape" && event.target === dialogRef.current) {
          event.preventDefault();
          dialogRef.current?.close();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (busy) {
          return;
        }
        dialogRef.current?.close();
      }}
    >
      <div className="confirm-dialog-content delete-history-dialog-content">
        <div className="delete-history-dialog-eyebrow">Delete Indexed History</div>
        <h3 className="confirm-dialog-title">{content.title}</h3>

        <div className="delete-history-dialog-target">
          <div className="delete-history-dialog-target-title">{target.title}</div>
          <div className="delete-history-dialog-target-meta">
            <span className={`meta-tag ${target.provider}`}>{content.providerLabel}</span>
            {content.summaryStats.map((stat) => (
              <span key={stat} className="delete-history-dialog-stat">
                {stat}
              </span>
            ))}
          </div>
          <div className="delete-history-dialog-path" title={target.path}>
            {target.path}
          </div>
        </div>

        <section className="delete-history-dialog-section">
          <h4>What Happens Now</h4>
          <p>{content.deleteNow}</p>
        </section>

        <section className="delete-history-dialog-section">
          <h4>What Happens On Future Refresh</h4>
          <ul className="delete-history-dialog-list">
            {content.futureBehavior.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {errorMessage ? (
          <div role="alert" className="delete-history-dialog-error">
            {errorMessage}
          </div>
        ) : null}

        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="tb-btn"
            disabled={busy}
            onClick={() => dialogRef.current?.close()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="tb-btn destructive"
            disabled={busy}
            onClick={() => {
              confirmedRef.current = true;
              onConfirm();
            }}
          >
            {busy ? "Deleting..." : content.confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
