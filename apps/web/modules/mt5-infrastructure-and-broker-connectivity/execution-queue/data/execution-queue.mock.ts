import type {
  ExecutionFeedback,
  ExecutionQueueItem,
  QueueBottleneck,
  QueueLog
} from "../types/execution-queue.types";

export type ExecutionQueueSeed = {
  items: ExecutionQueueItem[];
  feedback: ExecutionFeedback[];
  logs: QueueLog[];
  bottlenecks: QueueBottleneck[];
};

export function createExecutionQueueSeed(): ExecutionQueueSeed {
  return {
    items: [],
    feedback: [],
    logs: [],
    bottlenecks: []
  };
}
