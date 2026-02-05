import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

import { cn } from "../../../lib/utils";
import { ServiceIcon } from "../../ui/service-icon";

export const ActionNode = memo(({ data, selected, id }: NodeProps) => {
  const hasConfig = data.serviceId && data.actionId;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const onDeleteNode = data.onDeleteNode as
      | ((nodeId: string) => void)
      | undefined;
    if (onDeleteNode) {
      onDeleteNode(id);
    } else {
      console.error("onDeleteNode is not defined!");
    }
  };

  return (
    <div
      className={cn(
        "group relative min-w-[220px] rounded-xl border-2 px-5 py-4 shadow-xl transition-all duration-200",
        "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]/95",
        selected
          ? "scale-105 border-[hsl(var(--primary))] ring-4 ring-[hsl(var(--primary))] ring-opacity-25 ring-offset-2 ring-offset-[hsl(var(--background))]"
          : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:shadow-2xl",
      )}
    >
      <button
        onClick={handleDelete}
        className="absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] opacity-0 shadow-lg transition-opacity hover:bg-[hsl(var(--destructive))]/90 group-hover:opacity-100"
        title="Delete node"
      >
        <svg
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <div className="mb-3 flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            hasConfig
              ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white dark:from-violet-600 dark:to-purple-500"
              : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
          )}
        >
          {hasConfig ? (
            <ServiceIcon
              serviceId={data.serviceId as string}
              logo={data.serviceLogo as string | undefined}
              size={20}
              className="text-white"
            />
          ) : (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Trigger
          </div>
          <div className="text-sm font-bold">{data.label || "New Trigger"}</div>
        </div>
      </div>
      {hasConfig ? (
        <div className="space-y-1 border-t border-[hsl(var(--border))] pt-2">
          <div className="text-xs text-[hsl(var(--muted-foreground))]">
            <span className="font-medium text-[hsl(var(--foreground))]">
              Service:
            </span>{" "}
            {data.serviceId}
          </div>
          <div className="text-xs text-[hsl(var(--muted-foreground))]">
            <span className="font-medium text-[hsl(var(--foreground))]">
              Action:
            </span>{" "}
            {data.actionId}
          </div>
          {data.params && Object.keys(data.params).length > 0 && (
            <div className="text-xs italic text-[hsl(var(--muted-foreground))]">
              {Object.keys(data.params).length} parameter(s) set
            </div>
          )}
        </div>
      ) : (
        <div className="border-t border-[hsl(var(--border))] pt-2 text-xs italic text-[hsl(var(--muted-foreground))]">
          Click to configure
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-4 !w-4 !border-2 !border-[hsl(var(--background))] !bg-[hsl(var(--primary))] transition-transform hover:!scale-125"
      />
    </div>
  );
});

ActionNode.displayName = "ActionNode";
