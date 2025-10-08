import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

export const ReactionNode = memo(({ data, selected, id }: NodeProps) => {
  const hasConfig = data.serviceId && data.reactionId;
  const onDeleteNode = data.onDeleteNode as
    | ((nodeId: string) => void)
    | undefined;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(
      "Delete clicked on ReactionNode, onDeleteNode:",
      onDeleteNode,
      "id:",
      id,
    );
    if (onDeleteNode) {
      onDeleteNode(id);
    } else {
      console.error("onDeleteNode is not defined in ReactionNode!");
    }
  };

  return (
    <div
      className={`group relative rounded-xl border-2 bg-white px-5 py-4 shadow-xl min-w-[220px] transition-all duration-200 ${
        selected
          ? "border-emerald-600 ring-4 ring-emerald-200 scale-105"
          : hasConfig
            ? "border-emerald-500 hover:border-emerald-600 hover:shadow-2xl"
            : "border-gray-300 hover:border-gray-400"
      }`}
    >
      {/* Delete Button */}
      <button
        onClick={handleDelete}
        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 flex items-center justify-center z-10"
        title="Delete node"
      >
        <svg
          className="w-3 h-3"
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

      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            hasConfig
              ? "bg-gradient-to-br from-emerald-500 to-teal-600"
              : "bg-gray-200"
          }`}
        >
          <svg
            className="w-5 h-5 text-white"
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
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Action
          </div>
          <div className="text-sm font-bold text-gray-900">
            {data.label || "New Action"}
          </div>
        </div>
      </div>
      {hasConfig ? (
        <div className="space-y-1 pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-600">
            <span className="font-medium">Service:</span> {data.serviceId}
          </div>
          <div className="text-xs text-gray-600">
            <span className="font-medium">Reaction:</span> {data.reactionId}
          </div>
          {data.params && Object.keys(data.params).length > 0 && (
            <div className="text-xs text-gray-500 italic">
              {Object.keys(data.params).length} parameter(s) set
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-400 italic pt-2 border-t border-gray-100">
          Click to configure
        </div>
      )}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-white hover:!scale-125 transition-transform"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-white hover:!scale-125 transition-transform"
      />
    </div>
  );
});

ReactionNode.displayName = "ReactionNode";
