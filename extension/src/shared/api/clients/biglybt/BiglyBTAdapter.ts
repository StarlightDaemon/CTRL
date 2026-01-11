import { injectable } from 'tsyringe';
import { TransmissionAdapter } from '../transmission/TransmissionAdapter';
import { ServerConfig } from '@/shared/lib/types';

@injectable()
export class BiglyBTAdapter extends TransmissionAdapter {
    constructor(config: ServerConfig) {
        super(config);
        // BiglyBT might default to a different path or port, but config handles that.
        // We can override methods here if BiglyBT has specific quirks.
        // For now, it fully supports Transmission RPC.
    }
}
