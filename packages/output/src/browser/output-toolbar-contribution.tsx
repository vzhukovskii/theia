/********************************************************************************
 * Copyright (C) 2019 Arm and others.
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

import * as React from 'react';
import { inject, injectable } from 'inversify';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { OutputWidget } from './output-widget';
import { OutputCommands } from './output-contribution';
import { OutputChannelManager } from '../common/output-channel';

@injectable()
export class OutputToolbarContribution implements TabBarToolbarContribution {

    @inject(OutputChannelManager)
    protected readonly outputChannelManager: OutputChannelManager;

    async registerToolbarItems(toolbarRegistry: TabBarToolbarRegistry): Promise<void> {
        toolbarRegistry.registerItem({
            id: 'channels',
            render: () => this.renderChannelSelector(),
            isVisible: widget => widget instanceof OutputWidget,
            onDidChange: this.outputChannelManager.onSelectedChannelChanged
        });
        toolbarRegistry.registerItem({
            id: OutputCommands.CLEAR__SELECTED.id,
            command: OutputCommands.CLEAR__SELECTED.id,
            tooltip: OutputCommands.CLEAR__SELECTED.label,
            priority: 1,
        });
        toolbarRegistry.registerItem({
            id: OutputCommands.SCROLL_LOCK__SELECTED.id,
            render: () => <ScrollLockToolbarItem
                key={OutputCommands.SCROLL_LOCK__SELECTED.id}
                outputChannelManager={this.outputChannelManager} />,
            isVisible: widget => widget instanceof OutputWidget,
            priority: 2
        });
    }

    protected readonly NONE = '<no channels>';

    protected renderChannelSelector(): React.ReactNode {
        const channelOptionElements: React.ReactNode[] = [];
        this.outputChannelManager.getVisibleChannels().forEach(channel => {
            channelOptionElements.push(<option value={channel.name} key={channel.name}>{channel.name}</option>);
        });
        if (channelOptionElements.length === 0) {
            channelOptionElements.push(<option key={this.NONE} value={this.NONE}>{this.NONE}</option>);
        }
        return <select
            className='theia-select'
            id='outputChannelList'
            key='outputChannelList'
            value={this.outputChannelManager.selectedChannel ? this.outputChannelManager.selectedChannel.name : this.NONE}
            onChange={this.changeChannel}
        >
            {channelOptionElements}
        </select>;
    }

    protected changeChannel = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const channelName = event.target.value;
        if (channelName !== this.NONE) {
            this.outputChannelManager.selectedChannel = this.outputChannelManager.getChannel(channelName);
        }
    };
}

export namespace ScrollLockToolbarItem {
    export interface Props {
        readonly outputChannelManager: OutputChannelManager;
    }
    export interface State {
        readonly lockedChannels: Array<string>;
    }
}
class ScrollLockToolbarItem extends React.Component<ScrollLockToolbarItem.Props, ScrollLockToolbarItem.State> {

    protected readonly toDispose = new DisposableCollection();

    constructor(props: Readonly<ScrollLockToolbarItem.Props>) {
        super(props);
        const lockedChannels = this.manager.getChannels().filter(({ isLocked }) => isLocked).map(({ name }) => name);
        this.state = { lockedChannels };
    }

    componentDidMount(): void {
        this.toDispose.pushAll([
            // Update when the selected channel changes.
            this.manager.onSelectedChannelChanged(() => this.setState({ lockedChannels: this.state.lockedChannels })),
            // Update when the selected channel's scroll-lock state changes.
            this.manager.onChannelLocked(({ name }) => {
                const isLocked = this.manager.getChannel(name).isLocked;
                const lockedChannels = this.state.lockedChannels.slice();
                if (isLocked) {
                    lockedChannels.push(name);
                } else {
                    const index = lockedChannels.indexOf(name);
                    if (index === -1) {
                        console.warn(`Could not unlock channel '${name}'. It was not locked.`);
                    } else {
                        lockedChannels.splice(index, 1);
                    }
                }
                this.setState({ lockedChannels });
            }),
        ]);
    }

    componentWillUnmount(): void {
        this.toDispose.dispose();
    }

    render(): React.ReactNode {
        const { selectedChannel } = this.manager;
        if (!selectedChannel) {
            return undefined;
        }
        return <div
            key='output:toggleScrollLock'
            className={`fa fa-${selectedChannel.isLocked ? 'lock' : 'unlock-alt'} item enabled`}
            title={`Turn Auto Scrolling ${selectedChannel.isLocked ? 'On' : 'Off'}`}
            onClick={this.toggleScrollLock} />;
    }

    protected readonly toggleScrollLock = (e: React.MouseEvent<HTMLElement>) => this.doToggleScrollLock(e);
    protected doToggleScrollLock(e: React.MouseEvent<HTMLElement>): void {
        const { selectedChannel } = this.manager;
        if (selectedChannel) {
            selectedChannel.toggleLocked();
            e.stopPropagation();
        }
    }

    private get manager(): OutputChannelManager {
        return this.props.outputChannelManager;
    }

}
