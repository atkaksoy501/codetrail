import type { IpcChannel, IpcRequestInput, IpcResponse } from "@codetrail/core";

declare global {
  interface Window {
    codetrail: {
      invoke<C extends IpcChannel>(
        channel: C,
        payload: IpcRequestInput<C>,
      ): Promise<IpcResponse<C>>;
    };
  }
}
