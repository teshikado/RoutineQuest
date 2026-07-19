import { SettingsClient } from "@/components/settings/settings-client";
import packageJson from "../../../../package.json";

export default function SettingsPage() {
  return <SettingsClient appVersion={packageJson.version} />;
}
