import type { ContractAddress, SigningKey } from '@midnight-ntwrk/compact-runtime';
import type { PrivateStateId, PrivateStateProvider } from '@midnight-ntwrk/midnight-js-types';

export class InMemoryPrivateStateProvider<PSI extends PrivateStateId = PrivateStateId, PS = any>
  implements PrivateStateProvider<PSI, PS>
{
  private state = new Map<string, PS>();
  private signingKeys = new Map<string, SigningKey>();
  private contractAddress: string | null = null;

  setContractAddress(address: ContractAddress): void {
    this.contractAddress = address;
  }

  private getKey(id: PSI): string {
    if (!this.contractAddress) {
      throw new Error("Contract address must be set before accessing private state.");
    }
    return `${this.contractAddress}:${id}`;
  }

  async set(privateStateId: PSI, state: PS): Promise<void> {
    this.state.set(this.getKey(privateStateId), state);
  }

  async get(privateStateId: PSI): Promise<PS | null> {
    return this.state.get(this.getKey(privateStateId)) ?? null;
  }

  async remove(privateStateId: PSI): Promise<void> {
    this.state.delete(this.getKey(privateStateId));
  }

  async clear(): Promise<void> {
    this.state.clear();
  }

  async setSigningKey(address: ContractAddress, signingKey: SigningKey): Promise<void> {
    this.signingKeys.set(address, signingKey);
  }

  async getSigningKey(address: ContractAddress): Promise<SigningKey | null> {
    return this.signingKeys.get(address) ?? null;
  }

  async removeSigningKey(address: ContractAddress): Promise<void> {
    this.signingKeys.delete(address);
  }

  async clearSigningKeys(): Promise<void> {
    this.signingKeys.clear();
  }

  async exportPrivateStates(): Promise<any> { throw new Error('Not implemented'); }
  async importPrivateStates(): Promise<any> { throw new Error('Not implemented'); }
  async exportSigningKeys(): Promise<any> { throw new Error('Not implemented'); }
  async importSigningKeys(): Promise<any> { throw new Error('Not implemented'); }
}
