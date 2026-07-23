import type { InputHTMLAttributes } from "react";
import { cx } from "../lib/cx";
import { Input } from "./Input";

type CredentialInputMode = "pin" | "password";

const pinClass = "max-w-[13.5rem] text-center text-lg tracking-[0.4em] tabular-nums";

/** Shared credential field for PIN or password (setup / login). */
export function CredentialInput({
  mode,
  className,
  type = "password",
  autoComplete,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { mode: CredentialInputMode }) {
  const isPin = mode === "pin";

  return (
    <Input
      {...props}
      type={type}
      className={cx(isPin && pinClass, className)}
      // PIN must not use new-password — Chrome treats that as "generate password".
      autoComplete={isPin ? "one-time-code" : autoComplete}
      {...(isPin
        ? {
            inputMode: "numeric" as const,
            pattern: "[0-9]*",
            autoCorrect: "off",
            spellCheck: false,
            "data-1p-ignore": true,
            "data-lpignore": "true",
            "data-bwignore": true,
          }
        : null)}
    />
  );
}
