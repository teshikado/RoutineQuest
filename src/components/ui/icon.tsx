import * as Icons from "lucide-react";
import { Sparkles, type LucideProps } from "lucide-react";

type IconsMap = Record<string, React.ForwardRefExoticComponent<LucideProps>>;

export function DynamicIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = (Icons as unknown as IconsMap)[name] ?? Sparkles;
  return <Icon {...props} />;
}
