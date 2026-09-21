"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, Sparkles, Check, X, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { signUpAction } from "@/app/actions/auth";
import { evaluatePasswordStrength, generateStrongPassword } from "@/lib/auth/password";

export default function SignUpPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const evalResult = evaluatePasswordStrength(password, username);

  const checks = [
    { label: "12+ characters", pass: password.length >= 12 },
    { label: "Uppercase letter", pass: /[A-Z]/.test(password) },
    { label: "Lowercase letter", pass: /[a-z]/.test(password) },
    { label: "Number", pass: /[0-9]/.test(password) },
    { label: "Special symbol", pass: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password) },
    { label: "High complexity", pass: evalResult.score >= 3 },
  ];

  function handleGeneratePassword() {
    const strong = generateStrongPassword();
    setPassword(strong);
    setShowPassword(true);
    setErrors([]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);

    if (!evalResult.isValid) {
      setErrors(evalResult.errors);
      return;
    }

    startTransition(async () => {
      const res = await signUpAction({ username, email, password });
      if (!res.success) {
        setErrors(res.errors || ["Failed to create account."]);
      } else {
        router.push(res.redirect || "/setup");
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="space-y-2 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Create your Job OS account</h1>
          <p className="text-sm text-muted-foreground">
            Set up your identity and credentials to start your automated career system.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="username">
              Username
            </label>
            <Input
              id="username"
              type="text"
              placeholder="e.g. alex_rivera"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="email">
              Dedicated job search email <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <Input
              id="email"
              type="email"
              placeholder="alex.jobs@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <p className="text-[11px] text-muted-foreground">
              We recommend a dedicated email specifically for your job search.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="password">
                Password
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Sparkles className="h-3 w-3" />
                Generate very strong password
              </button>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter a very strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Strength Indicators */}
          {password.length > 0 && (
            <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3 text-xs">
              <div className="flex items-center justify-between font-medium">
                <span>Password strength:</span>
                <Badge
                  variant={evalResult.isValid ? "success" : evalResult.score >= 2 ? "warning" : "danger"}
                  className="text-[10px]"
                >
                  {evalResult.isValid ? "Very strong" : evalResult.score >= 2 ? "Moderate" : "Weak"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-1 pt-1">
                {checks.map((chk, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px]">
                    {chk.pass ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    )}
                    <span className={chk.pass ? "text-foreground" : "text-muted-foreground"}>
                      {chk.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
              {errors.map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
            </div>
          )}

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={isPending || (password.length > 0 && !evalResult.isValid)}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                Create account & proceed to setup
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <div className="text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
