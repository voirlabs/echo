import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-logo">
        <Logo size={34} />
      </div>
      {children}
    </div>
  );
}
