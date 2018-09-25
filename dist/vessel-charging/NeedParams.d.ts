import BaseNeedParams from '../NeedParams';
import { IDimensions } from '../common-types';
import { EnergySources, Amenities } from './enums';
/**
 * @class The Class boat-charging/NeedParams represent the parameters of boat-charging need.
 */
export default class NeedParams extends BaseNeedParams {
    static _protocol: string;
    static _messageType: string;
    radius: number;
    startAt: number;
    dimensions: IDimensions;
    batteryCapacity: number;
    currentBatteryCharge: number;
    energySource: EnergySources;
    amenities: Amenities[];
    constructor(values?: Partial<NeedParams>);
    serialize(): {
        ttl: number;
        protocol: string;
        type: string;
    };
    deserialize(json: any): void;
}
//# sourceMappingURL=NeedParams.d.ts.map