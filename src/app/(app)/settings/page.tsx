import { SignOutButton } from "./SignOutButton";
import { ThemeToggle } from "./ThemeToggle";

export const metadata = { title: "Settings · Stacks" };

export default function SettingsPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>

      <section className="mt-6 space-y-6">
        <div>
          <h2 className="text-sm font-medium">Theme</h2>
          <ThemeToggle />
        </div>

        <div className="border-t border-rule pt-6">
          <SignOutButton />
        </div>
      </section>
    </>
  );
}
