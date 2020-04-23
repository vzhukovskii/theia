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
import { CommandRegistry, CommandContribution } from '@theia/core/lib/common/command';
import { OutputCommands } from '../browser/output-contribution';
import { OutputUri } from './output-uri';

@injectable()
export class OutputChannelManager implements FrontendApplicationContribution, CommandContribution, Disposable {

    @inject(OutputPreferences)
    protected readonly preferences: OutputPreferences;

    @inject(StorageService)
    protected readonly storageService: StorageService;

    protected readonly channels = new Map<string, OutputChannel>();
    protected _selectedChannel?: OutputChannel | undefined;

    protected readonly channelAddedEmitter = new Emitter<{ name: string }>();
    protected readonly channelDeletedEmitter = new Emitter<{ name: string }>();
    protected readonly channelLockedEmitter = new Emitter<{ name: string }>();
    protected readonly selectedChannelChangedEmitter = new Emitter<{ name?: string }>();

    readonly onChannelAdded = this.channelAddedEmitter.event;
    readonly onChannelDeleted = this.channelDeletedEmitter.event;
    readonly onChannelLocked = this.channelLockedEmitter.event; // TODO: does this belong here?
    readonly onSelectedChannelChanged = this.selectedChannelChangedEmitter.event;

    protected toDispose = new DisposableCollection();
    protected toDisposeOnChannelDeletion = new Map<string, DisposableCollection>();

    protected lockedChannels = new Set<string>();
    protected restoredState = new Deferred<void>();

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
            this.channelAddedEmitter,
            this.channelDeletedEmitter,
            this.channelLockedEmitter,
            this.selectedChannelChangedEmitter,
            this.onChannelAdded(({ name }) => this.registerListener(this.getChannel(name)),
                this.onChannelDeleted(({ name }) => {
                    if (this.selectedChannel && this.selectedChannel.name === name) {
                        this.selectedChannel = this.getVisibleChannels()[0];
                    }
                }))
        ]);
        this.getChannels().forEach(this.registerListener.bind(this));
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(OutputCommands.APPEND, {
            execute: ({ name, text }: { name: string, text: string }) => {
                if (name && text) {
                    this.getChannel(name).append(text);
                }
            }
        });
        registry.registerCommand(OutputCommands.APPEND_LINE, {
            execute: ({ name, text }: { name: string, text: string }) => {
                if (name && text) {
                    this.getChannel(name).appendLine(text);
                }
            }
        });
        registry.registerCommand(OutputCommands.CLEAR, {
            execute: ({ name }: { name: string }) => {
                if (name) {
                    this.getChannel(name).clear();
                }
            }
        });
        registry.registerCommand(OutputCommands.SHOW, {
            execute: ({ name, options }: { name: string, options?: { preserveFocus?: boolean } }) => {
                if (name) {
                    // TODO: Does this belong here or should go to the UI? Probably the latter.
                }
            }
        });
        registry.registerCommand(OutputCommands.HIDE, {
            execute: ({ name }: { name: string }) => {
                if (name) {
                    // TODO: same as for `show`. Figure out whether creating a new channel if does not exist is a good strategy or not.
                }
            }
        });
        registry.registerCommand(OutputCommands.DISPOSE, {
            execute: ({ name }: { name: string }) => {
                if (name) {
                    this.deleteChannel(name);
                }
            }
        });
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
        this.channelDeletedEmitter.fire({ name });
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
        return this._selectedChannel;
    }

    set selectedChannel(channel: OutputChannel | undefined) {
        this._selectedChannel = channel;
        const name = this._selectedChannel ? this._selectedChannel.name : undefined;
        this.selectedChannelChangedEmitter.fire({ name });
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
        this.model = monaco.editor.createModel('', 'plaintext', monaco.Uri.parse(OutputUri.create(name).toString()));
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
        // TODO: use `pushEditOperations` instead? Do we need undo/redo support?
        // TODO: check if cursor position can be handled with the `textModel` only.
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
