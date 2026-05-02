import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Key, Coins } from "lucide-react";
import type { ApiKeys } from "@/hooks/useApiKeys";
import type { BudgetMap, ModelKey } from "@/hooks/useBudgets";

interface Props {
  open: boolean;
  onClose: () => void;
  keys: ApiKeys;
  onUpdate: (field: keyof ApiKeys, value: string) => void;
  budgets: BudgetMap;
  onBudget: (model: ModelKey, value: string) => void;
}

function KeyInput({
  label,
  field,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  field: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={field} className="text-xs font-mono text-slate-400 uppercase tracking-wider">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={field}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-slate-950 border-slate-700 text-slate-200 font-mono text-xs pr-10 focus-visible:ring-cyan-500/50 placeholder:text-slate-600"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
        >
          {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

const BUDGET_MODELS: Array<{ key: ModelKey; label: string }> = [
  { key: "openai", label: "OpenAI" },
  { key: "gemini", label: "Gemini" },
  { key: "claude", label: "Claude Sonnet" },
  { key: "claude-opus", label: "Claude Opus" },
];

export default function SettingsModal({ open, onClose, keys, onUpdate, budgets, onBudget }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-mono text-slate-200">
            <Key className="w-4 h-4 text-cyan-400" />
            API Key Management
          </DialogTitle>
        </DialogHeader>

        <p className="text-[11px] font-mono text-slate-500 leading-relaxed -mt-1">
          Enter your own API keys to override server defaults. Keys are stored locally in your browser and never sent to any third party.
        </p>

        <div className="flex flex-col gap-4 mt-1">
          <KeyInput
            label="OpenAI API Key"
            field="openai"
            placeholder="sk-... (leave blank to use server key)"
            value={keys.openai}
            onChange={(v) => onUpdate("openai", v)}
          />
          <KeyInput
            label="Gemini API Key"
            field="gemini"
            placeholder="AIza... (leave blank to use server key)"
            value={keys.gemini}
            onChange={(v) => onUpdate("gemini", v)}
          />
          <KeyInput
            label="Anthropic API Key (Claude + Claude Opus)"
            field="anthropic"
            placeholder="sk-ant-... (leave blank to use server key)"
            value={keys.anthropic}
            onChange={(v) => onUpdate("anthropic", v)}
          />
        </div>

        <div className="border-t border-slate-800 pt-4 mt-2">
          <div className="flex items-center gap-2 mb-3">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-mono text-slate-300 uppercase tracking-wider">Per-Model Budget Limits</span>
          </div>
          <p className="text-[11px] font-mono text-slate-500 leading-relaxed mb-3">
            Set a dollar spend cap per model. Requests to an over-budget model are automatically blocked and routed to a fallback. Leave blank for unlimited.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {BUDGET_MODELS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label htmlFor={`budget-${key}`} className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  {label}
                </Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">$</span>
                  <Input
                    id={`budget-${key}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={budgets[key] !== undefined ? String(budgets[key]) : ""}
                    onChange={(e) => onBudget(key, e.target.value)}
                    placeholder="∞"
                    className="bg-slate-950 border-slate-700 text-slate-200 font-mono text-xs pl-6 focus-visible:ring-amber-500/50 placeholder:text-slate-600"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            onClick={onClose}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
