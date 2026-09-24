import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Dev: routes through Vite proxy (/bot/api → localhost:4001/api)
// Prod: set VITE_BOT_API_URL e.g. https://bot.startupvarsity.com
const BOT_BASE_URL = (import.meta.env.VITE_BOT_API_URL as string) ?? "/bot";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  phone: z
    .string()
    .min(10, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
});

type FormData = z.infer<typeof schema>;

interface LeadFormProps {
  onSuccess: (sessionId: string, name: string) => void;
}

export function LeadForm({ onSuccess }: LeadFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    try {
      // 1. Save lead
      const leadRes = await fetch(`${BOT_BASE_URL}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          source_page: window.location.pathname,
        }),
      });
      if (!leadRes.ok) throw new Error("Failed to save your details.");
      const lead = await leadRes.json();

      // 2. Create chat session
      const sessionRes = await fetch(`${BOT_BASE_URL}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id }),
      });
      if (!sessionRes.ok) throw new Error("Failed to start session.");
      const session = await sessionRes.json();

      onSuccess(session.session_id, data.name);
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Banner */}
      <div className="bg-gradient-to-br from-orange-50 to-orange-100 px-4 py-5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">Hi there! 👋</p>
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
            I'm Vasty, your StartUpVarsity guide. Share a few details and I'll
            help you find the right program.
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 p-4 flex-1">
        <div className="flex flex-col gap-1">
          <Label htmlFor="name" className="text-xs font-medium text-gray-700">
            Full Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Your name"
            className="h-9 text-sm"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-red-500">{errors.name.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="email" className="text-xs font-medium text-gray-700">
            Email <span className="text-red-500">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            className="h-9 text-sm"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="phone" className="text-xs font-medium text-gray-700">
            Phone{" "}
            <span className="text-gray-400 font-normal">(optional)</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+91 98765 43210"
            className="h-9 text-sm"
            {...register("phone")}
          />
          {errors.phone && (
            <p className="text-xs text-red-500">{errors.phone.message}</p>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 rounded px-2 py-1.5">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="mt-auto bg-orange-500 hover:bg-orange-600 text-white w-full h-9"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              Starting chat…
            </>
          ) : (
            "Start Chat →"
          )}
        </Button>
      </form>
    </div>
  );
}
