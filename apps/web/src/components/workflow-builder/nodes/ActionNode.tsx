import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

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
      className={`group relative rounded-xl border-2 bg-white px-5 py-4 shadow-xl min-w-[220px] transition-all duration-200 ${
        selected
          ? "border-violet-600 ring-4 ring-violet-200 scale-105"
          : hasConfig
            ? "border-violet-500 hover:border-violet-600 hover:shadow-2xl"
            : "border-gray-300 hover:border-gray-400"
      }`}
    >
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
              ? "bg-gradient-to-br from-violet-500 to-purple-600"
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
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Trigger
          </div>
          <div className="text-sm font-bold text-gray-900">
            {data.label || "New Trigger"}
          </div>
        </div>
      </div>
      {hasConfig ? (
        <div className="space-y-1 pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-600">
            <span className="font-medium">Service:</span> {data.serviceId}
          </div>
          <div className="text-xs text-gray-600">
            <span className="font-medium">Action:</span> {data.actionId}
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
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-violet-500 !border-2 !border-white hover:!scale-125 transition-transform"
      />
    </div>
  );
});

ActionNode.displayName = "ActionNode";
