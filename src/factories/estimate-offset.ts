import { interval, zip } from 'rxjs';
import { mask } from 'rxjs-broker';
import { finalize, map, mergeMap, scan, startWith } from 'rxjs/operators';
import { IPingEvent, IPongEvent } from '../interfaces';
import { TDataChannelEvent, TEstimateOffsetFactory } from '../types';

export const createEstimateOffset: TEstimateOffsetFactory = (performance) => {
    return (openedDataChannelSubjects) => {
        return openedDataChannelSubjects
            .pipe(
                mergeMap((dataChannelSubject) => {
                    const pingSubject = mask<undefined, IPingEvent, TDataChannelEvent>({ action: 'ping' }, dataChannelSubject);
                    const pongSubject = mask<number, IPongEvent, TDataChannelEvent>({ action: 'pong' }, dataChannelSubject);

                    // Respond to every ping event with the current value returned by performance.now().
                    const pingSubjectSubscription = pingSubject
                        .subscribe(() => pongSubject.send(performance.now()));

                    return zip(
                        interval(1000)
                            .pipe(
                                startWith(),
                                map(() => {
                                    // @todo It should be okay to send an empty message.
                                    pingSubject.send(undefined);

                                    return performance.now();
                                })
                            ),
                        pongSubject
                    )
                        .pipe(
                            finalize(() => pingSubjectSubscription.unsubscribe()),
                            map(([ pingTime, pongTime ]) => {
                                const now = performance.now();

                                // This will compute the offset with the formula "remoteTime - localTime".
                                return ((pongTime * 2) - pingTime - now) / 2;
                                // @todo Do fire an update event whenever the offset changes.
                            }),
                            scan<number, number[]>((latestValues, newValue) => [ ...latestValues.slice(-4), newValue ], [ ]),
                            map((values) => values.reduce((sum, currentValue) => sum + currentValue, 0) / values.length),
                            startWith(0)
                        );
                }),
                map((offset) => offset / 1000)
            );
    };
};