"use client";

import { useState, useEffect, useTransition } from "react";
import { Cpu, Cloud, Layers, Check, Loader2, RefreshCw, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getLlmConfigAction,
  saveLlmConfigAction,
  probeLocalLlmAction,
  type LlmConfigState,
} from "@/app/actions/setup-ai";

export function LlmSelectorStep({
  onContinue,
}: {
  onContinue: () => void;
}) {
  const [preference, setPreference] = useState<"local" | "paid" | "both">("both");
  const [defaultTier, setDefaultTier] = useState<"local" | "paid">("local");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [paidProvider, setPaidProvider] = useState<"openai" | "anthropic" | "gemini" | "openrouter">("openai");
  const [apiKey, setApiKey] = useState("");
  const [localStatus, setLocalStatus] = useState<{ online: boolean; models: string[] } | null>(null);
  const [probing, setProbing] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getLlmConfigAction().then((cfg) => {
      setPreference(cfg.modelPreference);
      setDefaultTier(cfg.defaultTier);
      if (cfg.ollamaUrl) setOllamaUrl(cfg.ollamaUrl);
    });
    checkLocalLlm("http://localhost:11434");
  }, []);

  async function checkLocalLlm(url: string) {
    setProbing(true);
    const res = await probeLocalLlmAction(url);
    setLocalStatus(res);
    setProbing(false);
  }

  function handleSaveAndContinue() {
    startTransition(async () => {
      await saveLlmConfigAction({
        modelPreference: preference,
        defaultTier,
        ollamaUrl,
        apiKey: apiKey.trim() ? { provider: paidProvider, key: apiKey } : undefined,
      });
      onContinue();
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Step 1: Choose your AI brain</h2>
        <p className="text-xs text-muted-foreground">
          Select which model architectures you want to power job analysis, resume tailoring, and interview simulations.
        </p>
      </div>

      {/* Model Choice Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setPreference("local")}
          className={`relative flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
            preference === "local"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border bg-card hover:bg-muted/30"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Cpu className="h-5 w-5" />
          </div>
          <div className="mt-3 font-medium text-sm">Local model only</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Runs 100% locally via Ollama. Completely private with zero external API calls.
          </p>
          {preference === "local" && (
            <Badge variant="success" className="mt-3 text-[10px]">
              Active Selection
            </Badge>
          )}
        </button>

        <button
          type="button"
          onClick={() => setPreference("paid")}
          className={`relative flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
            preference === "paid"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border bg-card hover:bg-muted/30"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
            <Cloud className="h-5 w-5" />
          </div>
          <div className="mt-3 font-medium text-sm">Paid model only</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Uses cloud providers (OpenAI, Anthropic, Gemini, or OpenRouter) with your API key.
          </p>
          {preference === "paid" && (
            <Badge variant="success" className="mt-3 text-[10px]">
              Active Selection
            </Badge>
          )}
        </button>

        <button
          type="button"
          onClick={() => setPreference("both")}
          className={`relative flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
            preference === "both"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border bg-card hover:bg-muted/30"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
            <Layers className="h-5 w-5" />
          </div>
          <div className="mt-3 font-medium text-sm">Both (Hybrid)</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Configures both local and paid models, with your choice of default priority.
          </p>
          {preference === "both" && (
            <Badge variant="success" className="mt-3 text-[10px]">
              Active Selection
            </Badge>
          )}
        </button>
      </div>

      {/* Priority Rule Selector when 'both' is active */}
      {preference === "both" && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Default Priority Configuration
            </div>
            <Badge variant="outline" className="text-[10px]">
              Rule Enforcement
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Choose which model tier takes precedence. If local model is selected as default, it remains the main model and paid calls are turned off.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDefaultTier("local")}
              className={`rounded-lg border p-3 text-left transition-all ${
                defaultTier === "local"
                  ? "border-primary bg-primary/10 text-foreground font-medium"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              <div className="text-xs font-medium">Local as default (Recommended)</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Local remains main model; paid models turned off.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setDefaultTier("paid")}
              className={`rounded-lg border p-3 text-left transition-all ${
                defaultTier === "paid"
                  ? "border-primary bg-primary/10 text-foreground font-medium"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              <div className="text-xs font-medium">Paid as default</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Paid model is primary; local serves as fallback.
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Local Model Endpoint Configuration */}
      {(preference === "local" || preference === "both") && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Local Ollama Endpoint</span>
            <div className="flex items-center gap-2">
              {probing ? (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Testing...
                </span>
              ) : localStatus?.online ? (
                <Badge variant="success" className="text-[10px] gap-1">
                  <Check className="h-3 w-3" />
                  Ollama detected ({localStatus.models.length} models)
                </Badge>
              ) : (
                <Badge variant="warning" className="text-[10px] gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Ollama not responding on port 11434
                </Badge>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => checkLocalLlm(ollamaUrl)}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <Input
            value={ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
            placeholder="http://localhost:11434"
            className="text-xs font-mono"
          />
        </div>
      )}

      {/* Paid Model Configuration */}
      {(preference === "paid" || preference === "both") && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Paid Provider API Key</span>
            <div className="flex gap-1.5">
              {(["openai", "anthropic", "gemini", "openrouter"] as const).map((prov) => (
                <button
                  key={prov}
                  type="button"
                  onClick={() => setPaidProvider(prov)}
                  className={`rounded px-2 py-1 text-[11px] uppercase transition-colors ${
                    paidProvider === prov
                      ? "bg-primary text-primary-foreground font-medium"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {prov}
                </button>
              ))}
            </div>
          </div>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={`Enter your ${paidProvider} API key (stored encrypted locally)`}
            className="text-xs font-mono"
          />
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={handleSaveAndContinue} disabled={pending} className="gap-2">
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving configuration...
            </>
          ) : (
            <>
              Save & Proceed to Master CV Upload
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
