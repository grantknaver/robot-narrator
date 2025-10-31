// tone.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToneService {
  private mod: typeof import('tone') | null = null;

  private async ensure() {
    if (!this.mod) this.mod = await import('tone');
    return this.mod;
  }

  async start() {
    const T = await this.ensure();
    return T.start();
  }

  async now() {
    const T = await this.ensure();
    return T.now();
  }

  async createPlayer(
    opts: ConstructorParameters<typeof import('tone')['Player']>[0]
  ) {
    const T = await this.ensure();
    return new T.Player(opts).toDestination();
  }

  async getDestination() {
    const T = await this.ensure();
    return T.getDestination();
  }

  // add wrappers you need: Transport, Gain, etc.
}
