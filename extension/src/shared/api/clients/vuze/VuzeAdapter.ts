import { injectable } from 'tsyringe';
import { TransmissionAdapter } from '../transmission/TransmissionAdapter';
import { ServerConfig } from '@/shared/lib/types';

@injectable()
export class VuzeAdapter extends TransmissionAdapter {
    constructor(config: ServerConfig) {
        super(config);
        // Vuze Remote WebUI is Transmission RPC compatible.
        // It typically runs on port 9091 (same as Transmission) or custom.
    }
}
