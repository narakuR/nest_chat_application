export class StreamTracker {
  readonly id: string;
  private _stopped = false;
  private _stop!: () => void;

  readonly stopPromise: Promise<void>;

  tokenCount = 0;
  startedAt = Date.now();
  stoppedAt?: number;
  finalToken?: string = '';

  constructor(id?: string) {
    this.id = id ?? crypto.randomUUID();
    this.stopPromise = new Promise<void>((resolve) => {
      this._stop = () => {
        if (!this._stopped) {
          this._stopped = true;
          this.stoppedAt = Date.now();
          this.finalToken = this.finalToken;
          resolve();
        }
      };
    });
  }

  stop(): void {
    this._stop();
  }

  get stopped(): boolean {
    return this._stopped;
  }

  stats(): {
    id: string;
    tokenCount: number;
    duration: number;
    stopped: boolean;
    finalToken: string;
  } {
    return {
      id: this.id,
      tokenCount: this.tokenCount,
      duration: (this.stoppedAt ?? Date.now()) - this.startedAt,
      stopped: this._stopped,
      finalToken: this.finalToken ?? '',
    };
  }
}

export async function ConsumeAIAssistantStream(
  stream: AsyncIterable<any>,
  tracker: StreamTracker,
  onToken: (token: string) => void,
) {
  const iterator = stream[Symbol.asyncIterator]();

  while (true) {
    const result = await Promise.race([iterator.next(), tracker.stopPromise]);
    if (!result || tracker.stopped) {
      break;
    }
    if (result.done) {
      break;
    }
    const token = result.value?.choices?.[0]?.delta?.content;
    if (token) {
      tracker.tokenCount++;
      tracker.finalToken += token;
      onToken(token);
    }
  }
}
