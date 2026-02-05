import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

import { cn } from "../../../lib/utils";
import { ServiceIcon } from "../../ui/service-icon";

export const ReactionNode = memo(({ data, selected, id }: NodeProps) => {
  const hasConfig = data.serviceId && data.reactionId;
  const onDeleteNode = data.onDeleteNode as
    | ((nodeId: string) => void)
    | undefined;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteNode) {
      onDeleteNode(id);
    } else {
      console.error("onDeleteNode is not defined in ReactionNode!");
    }
  };

  return (
    <div
      className={cn(
        "group relative min-w-[220px] rounded-xl border-2 px-5 py-4 shadow-xl transition-all duration-200",
        "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]/95",
        selected
          ? "scale-105 border-emerald-500 ring-4 ring-emerald-500 ring-opacity-25 ring-offset-2 ring-offset-[hsl(var(--background))]"
          : "border-[hsl(var(--border))] hover:border-emerald-400 hover:shadow-2xl",
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
              ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white dark:from-emerald-600 dark:to-teal-500"
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
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Action
          </div>
          <div className="text-sm font-bold">{data.label || "New Action"}</div>
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
              Reaction:
            </span>{" "}
            {data.reactionId}
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
        type="target"
        position={Position.Left}
        className="!h-4 !w-4 !border-2 !border-[hsl(var(--background))] !bg-emerald-500 transition-transform hover:!scale-125"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-4 !w-4 !border-2 !border-[hsl(var(--background))] !bg-emerald-500 transition-transform hover:!scale-125"
      />
    </div>
  );
});

ReactionNode.displayName = "ReactionNode";
