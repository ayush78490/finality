export type TxTask<T = void> = () => Promise<T>;

/**
 * A simple FIFO dispatcher that guarantees only one in-flight task per queue.
 * Use one dispatcher per signer to avoid nonce races.
 */
export class SerializedTxDispatcher {
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;

  constructor(private readonly queueName: string) {}

  depth(): number {
    return this.pending;
  }

  enqueue<T>(label: string, task: TxTask<T>): Promise<T> {
    this.pending += 1;
    const enqueuedAtMs = Date.now();

    const run = async (): Promise<T> => {
      const waitMs = Date.now() - enqueuedAtMs;
      console.log(
        JSON.stringify({
          level: "debug",
          msg: "tx_queue_task_start",
          queue: this.queueName,
          label,
          waitMs,
          depth: this.pending,
        })
      );

      try {
        return await task();
      } finally {
        this.pending -= 1;
        console.log(
          JSON.stringify({
            level: "debug",
            msg: "tx_queue_task_done",
            queue: this.queueName,
            label,
            depth: this.pending,
          })
        );
      }
    };

    const result = this.tail.then(run, run);
    this.tail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}
