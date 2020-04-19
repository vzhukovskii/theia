/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { injectable, inject, postConstruct } from 'inversify';
import { Emitter, Event, Disposable, DisposableCollection } from '@theia/core';
import { StorageService, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { OutputPreferences } from './output-preferences';

@injectable()
export class OutputChannelManager implements FrontendApplicationContribution, Disposable {
    protected readonly channels = new Map<string, OutputChannel>();
    protected selectedChannelValue: OutputChannel | undefined;

    protected readonly channelDeleteEmitter = new Emitter<{ channelName: string }>();
    protected readonly channelAddedEmitter = new Emitter<OutputChannel>();
    protected readonly selectedChannelEmitter: Emitter<void> = new Emitter<void>();
    protected readonly listOrSelectionEmitter: Emitter<void> = new Emitter<void>();
    protected readonly channelLockedEmitter = new Emitter<OutputChannel>();
    readonly onChannelDelete = this.channelDeleteEmitter.event;
    readonly onChannelAdded = this.channelAddedEmitter.event;
    readonly onSelectedChannelChange = this.selectedChannelEmitter.event;
    readonly onListOrSelectionChange = this.listOrSelectionEmitter.event;
    readonly onLockChange = this.channelLockedEmitter.event;

    protected toDispose = new DisposableCollection();
    protected toDisposeOnChannelDeletion = new Map<string, DisposableCollection>();
    protected lockedChannels = new Set<string>();
    protected restoredState = new Deferred<void>();

    @inject(OutputPreferences)
    protected readonly preferences: OutputPreferences;

    @inject(StorageService)
    protected readonly storageService: StorageService;

    onStart(): void {
        this.storageService.getData<Array<string>>('theia:output-channel-manager:lockedChannels')
            .then(lockedChannels => {
                if (Array.isArray(lockedChannels)) {
                    for (const channelName of lockedChannels) {
                        this.lockedChannels.add(channelName);
                    }
                }
                this.restoredState.resolve();
            });
    }

    onStop(): void {
        const lockedChannels = Array.from(this.channels.values()).filter(({ isLocked }) => isLocked).map(({ name }) => name);
        this.storageService.setData('theia:output-channel-manager:lockedChannels', lockedChannels);
    }

    @postConstruct()
    protected async init(): Promise<void> {
        await this.restoredState.promise;
        this.toDispose.pushAll([
            this.channelDeleteEmitter,
            this.channelAddedEmitter,
            this.selectedChannelEmitter,
            this.listOrSelectionEmitter,
            this.channelLockedEmitter
        ]);
        this.getChannels().forEach(this.registerListener.bind(this));
        this.toDispose.push(this.onChannelAdded(channel => {
            this.listOrSelectionEmitter.fire(undefined);
            this.registerListener(channel);
        }));
        this.toDispose.push(this.onChannelDelete(event => {
            this.listOrSelectionEmitter.fire(undefined);
            if (this.selectedChannel && this.selectedChannel.name === event.channelName) {
                this.selectedChannel = this.getVisibleChannels()[0];
            }
        }));
    }

    protected registerListener(outputChannel: OutputChannel): void {
        const { name } = outputChannel;
        if (!this.selectedChannel) {
            this.selectedChannel = outputChannel;
        }
        let toDispose = this.toDisposeOnChannelDeletion.get(name);
        if (!toDispose) {
            toDispose = new DisposableCollection();
            this.toDisposeOnChannelDeletion.set(name, toDispose);
        }
        toDispose.push(outputChannel);
        toDispose.push(outputChannel.onVisibilityChange(event => {
            if (event.visible) {
                this.selectedChannel = outputChannel;
            } else if (outputChannel === this.selectedChannel) {
                this.selectedChannel = this.getVisibleChannels()[0];
            }
        }));
        toDispose.push(outputChannel.onLockChange(() => this.channelLockedEmitter.fire(outputChannel)));
        if (this.lockedChannels.has(name)) {
            if (!outputChannel.isLocked) {
                outputChannel.toggleLocked();
            }
        }
    }

    getChannel(name: string): OutputChannel {
        const existing = this.channels.get(name);
        if (existing) {
            return existing;
        }
        const channel = new OutputChannel(name, this.preferences);
        this.channels.set(name, channel);
        this.channelAddedEmitter.fire(channel);
        return channel;
    }

    deleteChannel(name: string): void {
        const existing = this.channels.get(name);
        if (!existing) {
            console.warn(`Could not delete channel '${name}'. The channel does not exist.`);
            return;
        }
        this.channels.delete(name);
        const toDispose = this.toDisposeOnChannelDeletion.get(name);
        if (toDispose) {
            toDispose.dispose();
        }
        this.channelDeleteEmitter.fire({ channelName: name });
    }

    getChannels(): OutputChannel[] {
        return Array.from(this.channels.values());
    }

    getVisibleChannels(): OutputChannel[] {
        return this.getChannels().filter(channel => channel.isVisible);
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    get selectedChannel(): OutputChannel | undefined {
        return this.selectedChannelValue;
    }

    set selectedChannel(channel: OutputChannel | undefined) {
        this.selectedChannelValue = channel;
        this.selectedChannelEmitter.fire(undefined);
        this.listOrSelectionEmitter.fire(undefined);
    }

    toggleScrollLock(channel: OutputChannel | undefined = this.selectedChannel): void {
        if (channel) {
            channel.toggleLocked();
        }
    }
}

export class OutputChannel implements Disposable {

    private readonly visibilityChangeEmitter = new Emitter<{ visible: boolean }>();
    private readonly lockChangeEmitter = new Emitter<{ locked: boolean }>();
    private readonly contentChangeEmitter = new Emitter<{ text: string }>();
    private readonly toDispose = new DisposableCollection(
        this.visibilityChangeEmitter,
        this.lockChangeEmitter,
        this.contentChangeEmitter
    );

    readonly model: monaco.editor.ITextModel;
    private visible: boolean = true;
    private locked: boolean = false;

    readonly onVisibilityChange: Event<{ visible: boolean }> = this.visibilityChangeEmitter.event;
    readonly onLockChange: Event<{ locked: boolean }> = this.lockChangeEmitter.event;
    readonly onContentChange: Event<{ text: string }> = this.contentChangeEmitter.event;

    constructor(readonly name: string, protected readonly preferences: OutputPreferences) {
        this.model = monaco.editor.createModel('', 'plaintext', monaco.Uri.parse(`output://${name}`));
        this.toDispose.pushAll([
            this.model,
            this.model.onDidChangeContent(event => {
                if (event.changes.length > 1) {
                    throw new Error('TODO: decide about the delta structure. can we expose IModelContentChangedEvent as-is?');
                }
                const { text } = event.changes[0];
                this.contentChangeEmitter.fire({ text });
            })
        ]);
    }

    append(text: string): void {
        const line = this.model.getLineCount();
        const column = this.model.getLineLength(line);
        const range = new monaco.Range(line, column, line, column);
        this.model.applyEdits([
            {
                range,
                text
            }
        ]);
    }

    appendLine(line: string): void {
        this.append(`${line}${this.model.getEOL()}`);
        // TODO: do not forget this! Maybe, we can remove text form the start of the model to support clipping.
        // const maxChannelHistory = this.preferences['output.maxChannelHistory'];
        // if (this.lines.length > maxChannelHistory) {
        //     this.lines.splice(0, this.lines.length - maxChannelHistory);
        // }
    }

    clear(): void {
        this.model.setValue('');
    }

    setVisibility(visible: boolean): void {
        this.visible = visible;
        this.visibilityChangeEmitter.fire({ visible });
    }

    getLines(): string[] {
        return this.model.getLinesContent();
    }

    get isVisible(): boolean {
        return this.visible;
    }

    toggleLocked(): void {
        this.locked = !this.locked;
        this.lockChangeEmitter.fire({ locked: this.isLocked });
    }

    get isLocked(): boolean {
        return this.locked;
    }

    dispose(): void {
        this.toDispose.dispose();
    }

}
