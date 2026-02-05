"use client";

import { useState } from "react";
import {
  Clock,
  Github,
  Code,
  Bot,
  Send,
  Webhook,
  CloudSun,
  MessageCircle,
  Mail,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "../../lib/utils";

const FALLBACK_ICONS: Record<string, LucideIcon> = {
  timer: Clock,
  github: Github,
  google: Mail,
  discord: MessageCircle,
  javascript: Code,
  openai: Bot,
  telegram: Send,
  "test-webhook": Webhook,
  weather: CloudSun,
};

type ServiceIconProps = {
  serviceId?: string;
  logo?: string;
  className?: string;
  size?: number;
};

export function ServiceIcon({
  serviceId,
  logo,
  className,
  size = 20,
}: ServiceIconProps) {
  const [imgError, setImgError] = useState(false);

  if (logo && !imgError) {
    return (
      <img
        src={logo}
        alt=""
        width={size}
        height={size}
        className={cn("object-contain", className)}
        onError={() => setImgError(true)}
        aria-hidden="true"
      />
    );
  }

  const FallbackIcon = FALLBACK_ICONS[(serviceId || "").toLowerCase()] || Zap;

  return <FallbackIcon className={className} size={size} aria-hidden="true" />;
}
