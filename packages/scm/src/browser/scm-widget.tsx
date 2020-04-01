/********************************************************************************
 * Copyright (C) 2019 Red Hat, Inc. and others.
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

/* eslint-disable no-null/no-null, @typescript-eslint/no-explicit-any */

import * as React from 'react';
import { Message } from '@phosphor/messaging';
import { injectable, inject, postConstruct, interfaces } from 'inversify';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import {
    BaseWidget, Widget, StatefulWidget, Panel, PanelLayout, MessageLoop} from '@theia/core/lib/browser';
import { AlertMessage } from '@theia/core/lib/browser/widgets/alert-message';
import { ScmCommitWidget } from './scm-commit-widget';
import { ScmAmendWidget } from './scm-amend-widget';
import { ScmService } from './scm-service';
import { ScmTreeWidget } from './scm-tree-widget';

@injectable()
export class ScmWidget extends BaseWidget implements StatefulWidget {

    protected panel: Panel;

    static ID = 'scm-view';

    @inject(ScmService) protected readonly scmService: ScmService;
    @inject(ScmCommitWidget) protected readonly commitWidget: ScmCommitWidget;
    @inject(ScmTreeWidget) protected readonly resourceWidget: ScmTreeWidget;
    @inject(ScmAmendWidget) protected readonly amendWidget: ScmAmendWidget;

    set viewMode(mode: 'tree' | 'flat') {
        this.resourceWidget.viewMode = mode;
    }
    get viewMode(): 'tree' | 'flat' {
        return this.resourceWidget.viewMode;
    }

    constructor() {
        super();
        this.node.tabIndex = 0;
        this.id = ScmWidget.ID;
        this.addClass('theia-scm');
        this.addClass('theia-scm-main-container');
    }

    @postConstruct()
    protected init(): void {
        const layout = new PanelLayout();
        this.layout = layout;
        this.panel = new Panel({
            layout: new PanelLayout ({
            })
        });
        this.panel.node.tabIndex = -1;
        this.panel.node.setAttribute('style', 'overflow: visible;');
        layout.addWidget(this.panel);

        this.containerLayout.addWidget(this.commitWidget);
        this.containerLayout.addWidget(this.resourceWidget);
        this.containerLayout.addWidget(this.amendWidget);

        this.refresh();
        this.toDispose.push(this.scmService.onDidChangeSelectedRepository(() => this.refresh()));
    }

    get containerLayout(): PanelLayout {
        return this.panel.layout as PanelLayout;
    }

    protected readonly toDisposeOnRefresh = new DisposableCollection();
    protected refresh(): void {
        this.toDisposeOnRefresh.dispose();
        this.toDispose.push(this.toDisposeOnRefresh);
        const repository = this.scmService.selectedRepository;
        this.title.label = repository ? repository.provider.label : 'no repository found';
        this.title.caption = this.title.label;
        this.update();
        if (repository) {
            this.toDisposeOnRefresh.push(repository.onDidChange(() => this.update()));
            // render synchronously to avoid cursor jumping
            // see https://stackoverflow.com/questions/28922275/in-reactjs-why-does-setstate-behave-differently-when-called-synchronously/28922465#28922465
            this.toDisposeOnRefresh.push(repository.input.onDidChange(() => this.updateImmediately()));
            this.toDisposeOnRefresh.push(repository.input.onDidFocus(() => this.focusInput()));
        }
    }

    protected updateImmediately(): void {
        this.onUpdateRequest(Widget.Msg.UpdateRequest);
    }

    protected onUpdateRequest(msg: Message): void {
        if (!this.isAttached || !this.isVisible) {
            return;
        }
        MessageLoop.sendMessage(this.commitWidget, msg);
        MessageLoop.sendMessage(this.resourceWidget, msg);
        MessageLoop.sendMessage(this.amendWidget, msg);
        super.onUpdateRequest(msg);
    }

    protected onAfterAttach(msg: Message): void {
        this.node.appendChild(this.commitWidget.node);
        this.node.appendChild(this.resourceWidget.node);
        this.node.appendChild(this.amendWidget.node);

        super.onAfterAttach(msg);
        this.update();
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.commitWidget.focus();
        this.update();
    }

    protected render(): React.ReactNode {
        const repository = this.scmService.selectedRepository;
        if (!repository) {
            return <AlertMessage
                type='WARNING'
                header='No repository found'
            />;
        }
    }

    protected focusInput(): void {
        this.commitWidget.focus();
    }

    storeState(): any {
        console.warn('saving state');
        const state: object = {
            commitState: this.commitWidget.storeState(),
            changesTreeState: this.resourceWidget.storeState(),
        };
        console.warn('state is ' + JSON.stringify(state));
        return state;
    }

    restoreState(oldState: any): void {
        const { commitState, changesTreeState } = oldState;
        this.commitWidget.restoreState(commitState);
        this.resourceWidget.restoreState(changesTreeState);
    }

}

export namespace ScmWidget {

    export namespace Factory {

        export interface WidgetOptions {
            readonly order?: number;
            readonly weight?: number;
            readonly initiallyCollapsed?: boolean;
            readonly canHide?: boolean;
            readonly initiallyHidden?: boolean;
        }

        export interface WidgetDescriptor {
            readonly widget: Widget | interfaces.ServiceIdentifier<Widget>;
            readonly options?: WidgetOptions;
        }
    }
}
