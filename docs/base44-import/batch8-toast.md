# RedAid batch 8 — PersonPicker + toast notifications

Converted: PersonPicker, ui/toast, ui/use-toast, ui/toaster. All new files.

## 1. Install
    npm install @radix-ui/react-toast
    npx shadcn@latest add dialog alert-dialog select switch textarea checkbox

(`checkbox` is new — PersonPicker uses it. The second command downloads the standard
shadcn components into `src/components/ui/`. Run both in the VS Code terminal, in your
project folder. If it asks questions, accept the defaults; if it asks to overwrite
`button`, `input` or `label`, say NO — those are the ones I converted.)

## 2. Show the toasts: add <Toaster /> to src/app/layout.tsx
Without this, every "Saved" / "Couldn't save" message silently shows nothing.

    import { AuthProvider } from "@/contexts/AuthContext";
    import { Toaster } from "@/components/ui/toaster";

    export default function RootLayout({ children }: { children: React.ReactNode }) {
      return (
        <html lang="en">
          <body>
            <AuthProvider>{children}</AuthProvider>
            <Toaster />
          </body>
        </html>
      );
    }

## What changed
- Types added; `"use client"` added where hooks are used.
- `use-toast`: now keeps at most 3 toasts and forgets a dismissed one after 5 seconds
  (Base44's copy kept 20, for about 16 minutes). It also subscribes once instead of
  re-subscribing every time a toast changes.
- PersonPicker reads `photo_url` (was `photo_uri`).
