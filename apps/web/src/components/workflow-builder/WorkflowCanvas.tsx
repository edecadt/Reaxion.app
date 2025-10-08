"use client";

import { useCallback, useRef, DragEvent, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  BackgroundVariant,
  MarkerType,
  type EdgeChange,
  applyEdgeChanges,
} from "reactflow";
import "reactflow/dist/style.css";

import { ActionNode } from "./nodes/ActionNode";
import { ReactionNode } from "./nodes/ReactionNode";

const nodeTypes: NodeTypes = {
  action: ActionNode,
  reaction: ReactionNode,
};

type WorkflowCanvasProps = {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  onNodesDelete?: (nodes: Node[]) => void;
  onDeleteNode?: (nodeId: string) => void;
  onInit?: (instance: any) => void;
};

let nodeIdCounter = 1;

export function WorkflowCanvas({
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onNodesDelete,
  onDeleteNode,
  onInit,
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const prevNodesLengthRef = useRef(initialNodes.length);
  const prevEdgesLengthRef = useRef(initialEdges.length);

  useEffect(() => {
    const currentLength = initialNodes.length;
    const prevLength = prevNodesLengthRef.current;

    if (currentLength > prevLength) {
      console.log(
        "WorkflowCanvas: initialNodes increased from",
        prevLength,
        "to",
        currentLength,
        "syncing...",
      );
      prevNodesLengthRef.current = currentLength;
      setNodes(
        initialNodes.map((node) => ({
          ...node,
          data: { ...node.data, onDeleteNode },
        })),
      );
    } else if (currentLength < prevLength) {
      console.log(
        "WorkflowCanvas: initialNodes decreased from",
        prevLength,
        "to",
        currentLength,
        "NOT syncing (deletion)",
      );
      prevNodesLengthRef.current = currentLength;
    }
  }, [initialNodes.length, onDeleteNode]);

  useEffect(() => {
    const currentLength = initialEdges.length;
    const prevLength = prevEdgesLengthRef.current;

    if (currentLength > prevLength) {
      console.log(
        "WorkflowCanvas: initialEdges increased from",
        prevLength,
        "to",
        currentLength,
        "syncing...",
      );
      prevEdgesLengthRef.current = currentLength;
      setEdges(initialEdges);
    } else if (currentLength < prevLength) {
      console.log(
        "WorkflowCanvas: initialEdges decreased from",
        prevLength,
        "to",
        currentLength,
        "NOT syncing (deletion)",
      );
      prevEdgesLengthRef.current = currentLength;
    }
  }, [initialEdges.length]);

  useEffect(() => {
    console.log("WorkflowCanvas: onDeleteNode changed, injecting into nodes");
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        data: { ...node.data, onDeleteNode },
      })),
    );
  }, [onDeleteNode, setNodes]);

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChangeInternal(changes);
    },
    [onNodesChangeInternal],
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      console.log("handleEdgesChange: changes=", changes);
      onEdgesChangeInternal(changes);
    },
    [onEdgesChangeInternal],
  );

  useEffect(() => {
    if (onNodesChange) {
      onNodesChange(nodes);
    }
  }, [nodes, onNodesChange]);

  useEffect(() => {
    if (onEdgesChange) {
      console.log("WorkflowCanvas: Edges changed, notifying parent:", edges);
      onEdgesChange(edges);
    }
  }, [edges, onEdgesChange]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge = {
        ...connection,
        type: "smoothstep",
        animated: true,
        style: { strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      const serviceData = event.dataTransfer.getData("application/service");

      if (!type || !reactFlowWrapper.current) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const newNode: Node = {
        id: `node-${nodeIdCounter++}`,
        type,
        position,
        data: {
          ...(serviceData
            ? JSON.parse(serviceData)
            : {
                label: type === "action" ? "New Trigger" : "New Action",
                serviceId: "",
                ...(type === "action" ? { actionId: "" } : { reactionId: "" }),
              }),
          onDeleteNode,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes, onDeleteNode],
  );

  const handleNodesDelete = useCallback(
    (deleted: Node[]) => {
      if (onNodesDelete) {
        onNodesDelete(deleted);
      }
    },
    [onNodesDelete],
  );

  const handleEdgesDelete = useCallback((deleted: Edge[]) => {
    console.log("Edges deleted:", deleted);
  }, []);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      console.log("Reconnecting edge:", oldEdge, "to:", newConnection);
      setEdges((eds) => {
        const filtered = eds.filter((e) => e.id !== oldEdge.id);
        const newEdge = {
          ...newConnection,
          id: `${newConnection.source}-${newConnection.target}`,
          type: "smoothstep",
          animated: true,
          style: { strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
          },
        };
        return addEdge(newEdge, filtered);
      });
    },
    [setEdges],
  );

  return (
    <div ref={reactFlowWrapper} style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onNodeClick={onNodeClick}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onInit={onInit}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        deleteKeyCode={["Backspace", "Delete"]}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={15} size={1} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
