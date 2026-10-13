"use client";

import { useRef, useState } from "react";
import { formatColumn, formatMinute, type EventKind, type GridLayout } from "@/lib/time";

type Pos = { row: number; col: number };

export type Brush = "1" | "2";

interface Common {
  layout: GridLayout;
  kind: EventKind;
  slotMin: number;
  final?: Set<number>;
  highlight?: Set<number>;
}

interface EditProps extends Common {
  mode: "edit";
  value: string;
  brush: Brush;
  onCommit: (next: string) => void;
}

interface GroupProps extends Common {
  mode: "group";
  yes: number[];
  maybe: number[];
  total: number;
  focus?: string | null; // a single person's slot string
  inspect: number | null;
  onInspect: (slot: number | null, sticky: boolean) => void;
}

function rowHeight(slotMin: number) {
  return slotMin === 15 ? 14 : slotMin === 30 ? 22 : 34;
}

export function Grid(props: EditProps | GroupProps) {
  const { layout, kind, slotMin } = props;
  const [drag, setDrag] = useState<{ anchor: Pos; cur: Pos; mode: "0" | Brush } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const h = rowHeight(slotMin);
  const cols = layout.columns.length;

  const inRect = (r: number, c: number) => {
    if (!drag) return false;
    const [r0, r1] = [drag.anchor.row, drag.cur.row].sort((a, b) => a - b);
    const [c0, c1] = [drag.anchor.col, drag.cur.col].sort((a, b) => a - b);
    return r >= r0 && r <= r1 && c >= c0 && c <= c1;
  };

  const posFromPoint = (x: number, y: number): Pos | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-row]");
    if (!el) return null;
    return { row: Number(el.dataset.row), col: Number(el.dataset.col) };
  };

  function commit() {
    document.documentElement.style.userSelect = "";
    const d = dragRef.current;
    if (!d || props.mode !== "edit") return;
    const chars = props.value.split("");
    const [r0, r1] = [d.anchor.row, d.cur.row].sort((a, b) => a - b);
    const [c0, c1] = [d.anchor.col, d.cur.col].sort((a, b) => a - b);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const slot = layout.cell[r][c];
        if (slot >= 0) chars[slot] = d.mode;
      }
    setDrag(null);
    const next = chars.join("");
    if (next !== props.value) props.onCommit(next);
  }

  function fillColumn(c: number) {
    if (props.mode !== "edit") return;
    const slots = layout.cell.map((row) => row[c]).filter((s) => s >= 0);
    const full = slots.every((s) => props.value[s] === props.brush);
    const chars = props.value.split("");
    for (const s of slots) chars[s] = full ? "0" : props.brush;
    props.onCommit(chars.join(""));
  }

  function cellStyle(slot: number, r: number, c: number): React.CSSProperties {
    if (slot < 0) return { background: "var(--cell-off)" };
    if (props.mode === "edit") {
      const v = drag && inRect(r, c) ? drag.mode : props.value[slot];
      if (v === "1") return { background: "rgb(var(--yes))" };
      if (v === "2")
        return {
          background:
            "repeating-linear-gradient(135deg, rgb(var(--maybe) / 0.95) 0 5px, rgb(var(--maybe) / 0.7) 5px 8px)",
        };
      return { background: drag && inRect(r, c) ? "rgb(var(--yes) / 0.12)" : "var(--cell-empty)" };
    }
    if (props.focus != null) {
      const v = props.focus[slot];
      if (v === "1") return { background: "rgb(var(--yes))" };
      if (v === "2") return { background: "rgb(var(--maybe) / 0.8)" };
      return { background: "var(--cell-empty)" };
    }
    if (!props.total) return { background: "var(--cell-empty)" };
    const score = (props.yes[slot] + props.maybe[slot] * 0.5) / props.total;
    if (score <= 0) return { background: "var(--cell-empty)" };
    return { background: `rgb(var(--yes) / ${(0.1 + score * 0.9).toFixed(3)})` };
  }

  const edit = props.mode === "edit";

  return (
    <div className="overflow-x-auto overscroll-x-contain -mx-1 px-1 pb-1">
      <div
        className="grid select-none"
        style={{
          gridTemplateColumns: `3.25rem repeat(${cols}, minmax(${cols > 7 ? 40 : 44}px, 1fr))`,
          columnGap: 4,
          minWidth: "min-content",
        }}
        onPointerDown={(e) => {
          if (!edit) return;
          const el = (e.target as HTMLElement).closest<HTMLElement>("[data-row]");
          if (!el || el.dataset.slot === "-1") return;
          e.preventDefault();
          window.getSelection()?.removeAllRanges();
          document.documentElement.style.userSelect = "none";
          e.currentTarget.setPointerCapture(e.pointerId);
          const pos = { row: Number(el.dataset.row), col: Number(el.dataset.col) };
          const slot = Number(el.dataset.slot);
          setDrag({ anchor: pos, cur: pos, mode: props.value[slot] === props.brush ? "0" : props.brush });
        }}
        onPointerMove={(e) => {
          if (!edit || !dragRef.current) return;
          const pos = posFromPoint(e.clientX, e.clientY);
          if (pos && (pos.row !== dragRef.current.cur.row || pos.col !== dragRef.current.cur.col)) {
            setDrag({ ...dragRef.current, cur: pos });
          }
        }}
        onPointerUp={commit}
        onPointerCancel={() => {
          document.documentElement.style.userSelect = "";
          setDrag(null);
        }}
        onPointerLeave={(e) => {
          if (!edit && e.pointerType === "mouse") (props as GroupProps).onInspect(null, false);
        }}
      >
        {/* header row */}
        <div className="sticky left-0 z-10 bg-card" />
        {layout.columns.map((c, ci) => {
          const label = formatColumn(c, kind);
          return (
            <button
              key={c.key}
              type="button"
              disabled={!edit}
              onClick={() => fillColumn(ci)}
              className={`pb-2 text-center leading-tight rounded-md touch-pan-x ${edit ? "hover:bg-paper-2 cursor-pointer" : "cursor-default"}`}
              title={edit ? "Fill or clear this day" : undefined}
            >
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">{label.top}</span>
              {label.bottom && <span className="block text-[13px] font-semibold text-ink tabular">{label.bottom}</span>}
            </button>
          );
        })}

        {layout.rows.map((minute, r) => {
          const onHour = minute % 60 === 0;
          const gap = layout.gapBefore[r];
          return [
            ...(gap
              ? [
                  <div key={`g${r}`} className="col-span-full h-3 flex items-center" aria-hidden="true">
                    <span className="ml-[3.25rem] flex-1 border-t border-dashed border-line" />
                  </div>,
                ]
              : []),
            <div
              key={`t${r}`}
              className="sticky left-0 z-10 bg-card relative touch-pan-y"
              style={{ height: h }}
            >
              {(onHour || gap || r === 0) && (
                <span className="absolute right-2 -top-[7px] text-[11px] font-medium text-muted tabular whitespace-nowrap">
                  {formatMinute(minute, { compact: true })}
                </span>
              )}
            </div>,
            ...layout.columns.map((_, c) => {
              const slot = layout.cell[r][c];
              const first = r === 0 || layout.gapBefore[r] || layout.cell[r - 1][c] < 0;
              const last = r === layout.rows.length - 1 || layout.gapBefore[r + 1] || layout.cell[r + 1][c] < 0;
              const isFinal = slot >= 0 && props.final?.has(slot);
              const isHi = slot >= 0 && props.highlight?.has(slot);
              const inspected = !edit && slot >= 0 && (props as GroupProps).inspect === slot;
              return (
                <div
                  key={`${r}-${c}`}
                  data-row={r}
                  data-col={c}
                  data-slot={slot}
                  className={`relative ${edit ? "touch-none cursor-crosshair" : "cursor-pointer"} ${first ? "rounded-t-lg" : ""} ${last ? "rounded-b-lg" : ""}`}
                  style={{
                    height: h,
                    ...cellStyle(slot, r, c),
                    boxShadow: [
                      !first ? `inset 0 1px 0 ${onHour ? "var(--line)" : "var(--line-2)"}` : "",
                      "inset 1px 0 0 var(--line-2), inset -1px 0 0 var(--line-2)",
                      first ? "inset 0 1px 0 var(--line-2)" : "",
                      last ? "inset 0 -1px 0 var(--line-2)" : "",
                    ]
                      .filter(Boolean)
                      .join(", "),
                    transition: "background-color 80ms",
                  }}
                  onPointerEnter={(e) => {
                    if (!edit && e.pointerType === "mouse" && slot >= 0) (props as GroupProps).onInspect(slot, false);
                  }}
                  onClick={() => {
                    if (!edit && slot >= 0) (props as GroupProps).onInspect(slot, true);
                  }}
                >
                  {(isFinal || isHi || inspected) && (
                    <span
                      className="pointer-events-none absolute inset-0"
                      style={{
                        borderLeft: `2px solid ${isFinal ? "var(--redleg)" : "var(--ink)"}`,
                        borderRight: `2px solid ${isFinal ? "var(--redleg)" : "var(--ink)"}`,
                        borderTop:
                          r === 0 || !(props.final?.has(layout.cell[r - 1][c]) || props.highlight?.has(layout.cell[r - 1][c])) || inspected
                            ? `2px solid ${isFinal ? "var(--redleg)" : "var(--ink)"}`
                            : undefined,
                        borderBottom:
                          r === layout.rows.length - 1 ||
                          !(props.final?.has(layout.cell[r + 1][c]) || props.highlight?.has(layout.cell[r + 1][c])) ||
                          inspected
                            ? `2px solid ${isFinal ? "var(--redleg)" : "var(--ink)"}`
                            : undefined,
                        borderRadius: 4,
                      }}
                    />
                  )}
                </div>
              );
            }),
          ];
        })}
        {/* closing time label */}
        <div className="sticky left-0 z-10 bg-card relative h-3">
          {(() => {
            const endMinute = layout.rows[layout.rows.length - 1] + slotMin;
            return endMinute % 60 === 0 ? (
              <span className="absolute right-2 -top-[7px] text-[11px] font-medium text-muted tabular whitespace-nowrap">
                {formatMinute(endMinute % 1440, { compact: true })}
              </span>
            ) : null;
          })()}
        </div>
      </div>
    </div>
  );
}
