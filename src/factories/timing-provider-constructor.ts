import { retryBackoff } from 'backoff-rxjs';
import { ConnectableObservable, EMPTY, Subject, Subscription, combineLatest, concat, defer, from } from 'rxjs';
import { IRemoteSubject, mask, wrap } from 'rxjs-broker';
import { accept } from 'rxjs-connector';
import { equals } from 'rxjs-etc/operators';
import {
    catchError,
    distinctUntilChanged,
    endWith,
    expand,
    first,
    ignoreElements,
    map,
    mapTo,
    mergeMap,
    publish,
    scan,
    startWith,
    withLatestFrom
} from 'rxjs/operators';
import { online } from 'subscribable-things';
import {
    ITimingProvider,
    ITimingStateVector,
    TConnectionState,
    TEventHandler,
    TTimingStateVectorUpdate,
    filterTimingStateVectorUpdate,
    translateTimingStateVector
} from 'timing-object';
import { TDataChannelEvent, TRequestEvent, TTimingProviderConstructor, TTimingProviderConstructorFactory, TUpdateEvent } from '../types';

const SUENC_URL = 'wss://matchmaker.suenc.io';
const PROVIDER_ID_REGEX = /^[\dA-Za-z]{20}$/;

export const createTimingProviderConstructor: TTimingProviderConstructorFactory = (
    estimateOffset,
    eventTargetConstructor,
    performance,
    setTimeout
): TTimingProviderConstructor => {
    return class TimingProvider extends eventTargetConstructor implements ITimingProvider {
        private _endPosition: number;

        private _error: null | Error;

        private _isMain: boolean;

        private _onadjust: null | [TEventHandler<this>, TEventHandler<this>];

        private _onchange: null | [TEventHandler<this>, TEventHandler<this>];

        private _onreadystatechange: null | [TEventHandler<this>, TEventHandler<this>];

        private _providerIdOrUrl: string;

        private _readyState: TConnectionState;

        private _remoteRequestsSubscription: null | Subscription;

        private _remoteUpdatesSubscription: null | Subscription;

        private _skew: number;

        private _startPosition: number;

        private _updateRequestsSubject: Subject<ITimingStateVector>;

        private _vector: ITimingStateVector;

        constructor(providerIdOrUrl: string, isMain: boolean) {
            // tslint:disable-next-line:no-console
            console.log('TimingProvider constructor url', providerIdOrUrl, 'isMain', isMain);
            super();

            const timestamp = performance.now() / 1000;

            this._isMain = isMain;
            this._endPosition = Number.POSITIVE_INFINITY;
            this._error = null;
            this._onadjust = null;
            this._onchange = null;
            this._onreadystatechange = null;
            this._providerIdOrUrl = providerIdOrUrl;
            this._readyState = 'connecting';
            this._remoteRequestsSubscription = null;
            this._remoteUpdatesSubscription = null;
            this._skew = 0;
            this._startPosition = Number.NEGATIVE_INFINITY;
            this._updateRequestsSubject = new Subject();
            this._vector = { acceleration: 0, position: 0, timestamp, velocity: 0 };

            this._createClient();
        }

        get endPosition(): number {
            return this._endPosition;
        }

        get error(): null | Error {
            return this._error;
        }

        get onadjust(): null | TEventHandler<this> {
            return this._onadjust === null ? this._onadjust : this._onadjust[0];
        }

        set onadjust(value) {
            if (this._onadjust !== null) {
                this.removeEventListener('adjust', this._onadjust[1]);
            }

            if (typeof value === 'function') {
                const boundListener = value.bind(this);

                this.addEventListener('adjust', boundListener);

                this._onadjust = [value, boundListener];
            } else {
                this._onadjust = null;
            }
        }

        get onchange(): null | TEventHandler<this> {
            return this._onchange === null ? this._onchange : this._onchange[0];
        }

        set onchange(value) {
            if (this._onchange !== null) {
                this.removeEventListener('change', this._onchange[1]);
            }

            if (typeof value === 'function') {
                const boundListener = value.bind(this);

                this.addEventListener('change', boundListener);

                this._onchange = [value, boundListener];
            } else {
                this._onchange = null;
            }
        }

        get onreadystatechange(): null | TEventHandler<this> {
            return this._onreadystatechange === null ? this._onreadystatechange : this._onreadystatechange[0];
        }

        set onreadystatechange(value) {
            if (this._onreadystatechange !== null) {
                this.removeEventListener('readystatechange', this._onreadystatechange[1]);
            }

            if (typeof value === 'function') {
                const boundListener = value.bind(this);

                this.addEventListener('readystatechange', boundListener);

                this._onreadystatechange = [value, boundListener];
            } else {
                this._onreadystatechange = null;
            }
        }

        get readyState(): TConnectionState {
            return this._readyState;
        }

        get skew(): number {
            return this._skew;
        }

        get startPosition(): number {
            return this._startPosition;
        }

        get vector(): ITimingStateVector {
            return this._vector;
        }

        public destroy(): void {
            if (this._remoteRequestsSubscription === null || this._remoteUpdatesSubscription === null) {
                throw new Error('The timingProvider is already destroyed.');
            }

            this._readyState = 'closed';
            this._remoteRequestsSubscription.unsubscribe();
            this._remoteRequestsSubscription = null;
            this._remoteUpdatesSubscription.unsubscribe();
            this._remoteUpdatesSubscription = null;
            this._updateRequestsSubject.complete();

            setTimeout(() => this.dispatchEvent(new Event('readystatechange')));
        }

        public update(newVector: TTimingStateVectorUpdate): Promise<void> {
            if (this._remoteUpdatesSubscription === null) {
                return Promise.reject(new Error("The timingProvider is destroyed and can't be updated."));
            }

            this._updateRequestsSubject.next({
                ...translateTimingStateVector(this._vector, performance.now() / 1000 - this._vector.timestamp),
                ...filterTimingStateVectorUpdate(newVector)
            });

            return Promise.resolve();
        }

        private _createClient(): void {
            const url = PROVIDER_ID_REGEX.test(this._providerIdOrUrl)
                ? `${SUENC_URL}?providerId=${this._providerIdOrUrl}`
                : this._providerIdOrUrl;
            const subjectConfig = {
                openObserver: {
                    next: () => {
                        this._readyState = 'open';
                        this.dispatchEvent(new Event('readystatechange'));
                    }
                }
            };
            const dataChannelSubjects = <ConnectableObservable<IRemoteSubject<TDataChannelEvent>>>concat(
                from(online()).pipe(equals(true), first(), ignoreElements()),
                defer(() => accept(url, subjectConfig))
            ).pipe(
                retryBackoff({ initialInterval: 1000, maxRetries: 3 }),
                catchError((err) => {
                    // tslint:disable-next-line:no-console
                    console.error('TimingProvider server connection err', err);
                    this._doCloseError(err);

                    return EMPTY;
                }),
                map((dataChannel) => wrap<TDataChannelEvent>(dataChannel)),
                publish() // tslint:disable-line:rxjs-no-connectable
            );
            const updateSubjects = dataChannelSubjects.pipe(
                map((dataChannelSubject) => {
                    return mask<TUpdateEvent['message'], TUpdateEvent, TDataChannelEvent>({ type: 'update' }, dataChannelSubject);
                })
            );
            const currentlyActiveUpdateSubjects = <ConnectableObservable<IRemoteSubject<TUpdateEvent['message']>[]>>updateSubjects.pipe(
                expand((updateSubject) =>
                    updateSubject.pipe(
                        catchError(() => EMPTY),
                        ignoreElements(),
                        endWith(updateSubject)
                    )
                ),
                scan<IRemoteSubject<TUpdateEvent['message']>, IRemoteSubject<TUpdateEvent['message']>[]>(
                    (activeUpdateSubjects, activeUpdateSubject) => {
                        const index = activeUpdateSubjects.indexOf(activeUpdateSubject);

                        if (index > -1) {
                            return [...activeUpdateSubjects.slice(0, index), ...activeUpdateSubjects.slice(index + 1)];
                        }

                        return [...activeUpdateSubjects, activeUpdateSubject];
                    },
                    []
                ),
                startWith([])
            );

            this._updateRequestsSubject.pipe(withLatestFrom(currentlyActiveUpdateSubjects)).subscribe(([vector, activeUpdateSubjects]) => {
                // tslint:disable-next-line:no-console
                console.log('TimingProvider _updateRequestsSubject send');
                activeUpdateSubjects.forEach((activeUpdateSubject) => {
                    try {
                        activeUpdateSubject.send({ ...vector, isMain: this._isMain });
                    } catch (err) {
                        // tslint:disable-next-line:no-console
                        console.error('TimingProvider isMain update send err', err);
                    }
                });
                if (this._isMain) {
                    this._setInternalVector(vector);
                }
            });

            this._remoteRequestsSubscription = updateSubjects
                .pipe(
                    withLatestFrom(dataChannelSubjects),
                    mergeMap(([updateSubject, dataChannelSubject], index) => {
                        const requestSubject = mask<TRequestEvent['message'], TRequestEvent, TDataChannelEvent>(
                            { type: 'request' },
                            dataChannelSubject
                        );

                        if (index === 0) {
                            try {
                                requestSubject.send(undefined);
                            } catch (err) {
                                // tslint:disable-next-line:no-console
                                console.error('TimingProvider request undefined err', err);
                                if (!this._isMain) {
                                    this._doCloseError(err);
                                }
                            }
                        }

                        return requestSubject.pipe(mapTo(updateSubject));
                    })
                )
                .subscribe((updatesSubject) => {
                    try {
                        updatesSubject.send({ ...this._vector, isMain: this._isMain });
                    } catch (err) {
                        // tslint:disable-next-line:no-console
                        console.error('TimingProvider request vector err', err);
                        if (!this._isMain) {
                            this._doCloseError(err);
                        }
                    }
                });

            this._remoteUpdatesSubscription = updateSubjects
                .pipe(
                    withLatestFrom(dataChannelSubjects),
                    mergeMap(([updateSubject, dataChannelSubject]) =>
                        combineLatest([updateSubject, estimateOffset(dataChannelSubject)]).pipe(
                            catchError((err) => {
                                // tslint:disable-next-line:no-console
                                console.error('TimingProvider estimateOffset err', err);

                                return EMPTY;
                            }),
                            distinctUntilChanged(([vectorA], [vectorB]) => vectorA === vectorB)
                        )
                    )
                )
                .subscribe(([{ acceleration, position, isMain, timestamp: remoteTimestamp, velocity }, offset]) => {
                    const timestamp = remoteTimestamp - offset;

                    if (this._isMain) {
                        const vector = translateTimingStateVector(this._vector, performance.now() / 1000 - this._vector.timestamp);

                        this._updateRequestsSubject.next(vector);
                    } else if (isMain) {
                        this._setInternalVector({ acceleration, position, timestamp, velocity });
                    }
                });

            dataChannelSubjects.connect();
        }

        private _doCloseError(err: any): void {
            this._error = err;
            this._readyState = 'closed';
            this.dispatchEvent(new Event('readystatechange'));
            this.dispatchEvent(new ErrorEvent('error', { error: err }));
        }

        private _setInternalVector(vector: ITimingStateVector): void {
            this._vector = vector;

            this.dispatchEvent(new CustomEvent('change', { detail: vector }));
        }
    };
};
