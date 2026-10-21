"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SignaturePadProps {
  /** PNG data URL once something has been drawn, or null when cleared. */
  onChange: (dataUrl: string | null) => void;
  height?: number;
}

interface Point {
  x: number;
  y: number;
}

/** Finger/mouse signature capture. */
export default function SignaturePad({ onChange, height = 176 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const moved = useRef(false);
  const last = useRef<Point | null>(null);

  // Setting canvas.width resets the context, so styles are re-applied each time.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 320;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1f2937";
  }, [height]);

  const pointOf = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    // Keeps the stroke going if the finger slides off the canvas edge.
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    moved.current = false;
    last.current = pointOf(event);
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    event.preventDefault();
    const ctx = event.currentTarget.getContext("2d");
    if (!ctx) return;
    const next = pointOf(event);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    last.current = next;
    moved.current = true;
  };

  const finish = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    // A tap without dragging draws nothing — don't count a blank page as "signed".
    if (moved.current) onChange(event.currentTarget.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ height }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        className="w-full touch-none rounded-xl border-2 border-dashed border-border bg-white"
      />
      <div className="mt-2 flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          <Eraser className="mr-2 h-4 w-4" />
          Clear
        </Button>
        <span className="text-xs text-muted-foreground">Draw with your finger or mouse</span>
      </div>
    </div>
  );
}
