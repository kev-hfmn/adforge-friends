"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="password" className="block text-sm font-medium">
        Password
      </label>
      <Input
        id="password"
        type="password"
        name="password"
        autoComplete="current-password"
        placeholder="Password"
        autoFocus
        required
        className="h-11 text-base"
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full h-11">
        {pending ? "Checking..." : "Sign in"}
      </Button>
    </form>
  );
}
