import { useState, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Package, AlertCircle, CheckCircle2, Eye, EyeOff, ArrowLeft, Mail, ShieldCheck } from "lucide-react";

type Step = "email" | "code" | "reset" | "done";

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [codeDigits, setCodeDigits] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const startResendCooldown = () => {
    setResendCooldown(60);
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStep("code");
      startResendCooldown();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setCodeDigits(["", "", "", "", "", ""]);
      startResendCooldown();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const next = [...codeDigits];
    next[index] = digit;
    setCodeDigits(next);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCodeDigits(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = codeDigits.join("");
    if (code.length < 6) { setError("Please enter the full 6-digit code"); return; }
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStep("reset");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStep("done");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const stepTitles: Record<Step, { title: string; description: string }> = {
    email: { title: "Reset Password", description: "Enter your registered email address" },
    code: { title: "Check Your Email", description: `We sent a 6-digit code to ${email}` },
    reset: { title: "New Password", description: `Set a new password for ${email}` },
    done: { title: "Password Reset!", description: "Your password has been updated successfully" },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-3 rounded-xl shadow-lg">
              <Package className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">EcoCut</h1>
              <p className="text-sm text-gray-500">Smart Inventory</p>
            </div>
          </div>
        </div>

        {/* Step indicators */}
        {step !== "done" && (
          <div className="flex items-center justify-center gap-2 mb-6">
            {(["email", "code", "reset"] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  step === s ? "bg-green-600 text-white" :
                  (["email", "code", "reset"] as Step[]).indexOf(step) > i ? "bg-green-200 text-green-700" :
                  "bg-gray-200 text-gray-400"
                }`}>
                  {(["email", "code", "reset"] as Step[]).indexOf(step) > i ? "✓" : i + 1}
                </div>
                {i < 2 && <div className={`w-8 h-0.5 ${(["email", "code", "reset"] as Step[]).indexOf(step) > i ? "bg-green-400" : "bg-gray-200"}`} />}
              </div>
            ))}
          </div>
        )}

        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-center">{stepTitles[step].title}</CardTitle>
            <CardDescription className="text-center">{stepTitles[step].description}</CardDescription>
          </CardHeader>
          <CardContent>

            {/* Step 1: Email */}
            {step === "email" && (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" placeholder="name@example.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} required className="h-11" />
                </div>
                <Button type="submit" className="w-full h-11 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending code...</> : <><Mail className="mr-2 h-4 w-4" />Send Verification Code</>}
                </Button>
                <div className="text-center">
                  <Link href="/login" className="text-sm text-green-600 hover:text-green-700 inline-flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" />Back to Sign In
                  </Link>
                </div>
              </form>
            )}

            {/* Step 2: Verification Code */}
            {step === "code" && (
              <form onSubmit={handleCodeSubmit} className="space-y-6">
                {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mb-4">
                    <ShieldCheck className="h-7 w-7 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-500">Enter the 6-digit code sent to your email. It expires in 10 minutes.</p>
                </div>

                <div className="flex justify-center gap-2" onPaste={handleCodePaste}>
                  {codeDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeInput(i, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(i, e)}
                      className="w-11 h-14 text-center text-xl font-bold border-2 rounded-lg outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-200"
                      style={{ borderColor: digit ? "#16a34a" : undefined }}
                    />
                  ))}
                </div>

                <Button type="submit" className="w-full h-11 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700" disabled={isLoading || codeDigits.join("").length < 6}>
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : "Verify Code"}
                </Button>

                <div className="text-center space-y-2">
                  <p className="text-sm text-gray-500">
                    Didn't receive the code?{" "}
                    {resendCooldown > 0 ? (
                      <span className="text-gray-400">Resend in {resendCooldown}s</span>
                    ) : (
                      <button type="button" onClick={handleResendCode} disabled={isLoading}
                        className="text-green-600 hover:text-green-700 font-medium">
                        Resend code
                      </button>
                    )}
                  </p>
                  <button type="button" onClick={() => { setStep("email"); setError(null); setCodeDigits(["","","","","",""]); }}
                    className="text-sm text-green-600 hover:text-green-700 inline-flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" />Use different email
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: New Password */}
            {step === "reset" && (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input id="newPassword" type={showPassword ? "text" : "password"} placeholder="Min. 8 characters"
                      value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="h-11 pr-10" />
                    <Button type="button" variant="ghost" size="sm"
                      className="absolute right-0 top-0 h-11 px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input id="confirmPassword" type={showConfirm ? "text" : "password"} placeholder="Repeat your new password"
                      value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="h-11 pr-10" />
                    <Button type="button" variant="ghost" size="sm"
                      className="absolute right-0 top-0 h-11 px-3 hover:bg-transparent"
                      onClick={() => setShowConfirm(!showConfirm)}>
                      {showConfirm ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting...</> : "Reset Password"}
                </Button>
              </form>
            )}

            {/* Step 4: Done */}
            {step === "done" && (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <div className="bg-green-100 rounded-full p-4">
                    <CheckCircle2 className="h-12 w-12 text-green-600" />
                  </div>
                </div>
                <p className="text-gray-600 text-sm">Your password has been reset. You can now sign in with your new password.</p>
                <Link href="/login">
                  <Button className="w-full h-11 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                    Sign In Now
                  </Button>
                </Link>
              </div>
            )}

          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-gray-500">Efficient inventory management for modern businesses</p>
      </div>
    </div>
  );
}
