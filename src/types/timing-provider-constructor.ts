import { ITimingProvider } from 'timing-object';

export type TTimingProviderConstructor = new (providerId: string, isMain: boolean) => ITimingProvider;
