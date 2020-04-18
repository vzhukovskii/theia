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

import '../../src/browser/style/output.css';
import { inject, injectable, postConstruct } from 'inversify';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { Message, BaseWidget } from '@theia/core/lib/browser';
import { OutputChannelManager, OutputChannel } from '../common/output-channel';

@injectable()
export class OutputWidget extends BaseWidget {

    static readonly ID = 'outputView';

    @inject(OutputChannelManager)
    protected readonly outputChannelManager: OutputChannelManager;

    protected readonly toDisposeOnSelectedChannelChange = new DisposableCollection();
    protected readonly editor: monaco.editor.IStandaloneCodeEditor;
    protected readonly emptyModel: monaco.editor.ITextModel;

    constructor() {
        super();
        this.id = OutputWidget.ID;
        this.title.label = 'Output';
        this.title.caption = 'Output';
        this.title.iconClass = 'fa fa-flag';
        this.title.closable = true;
        this.addClass('theia-output');
        this.node.tabIndex = 0;
        this.editor = monaco.editor.create(this.node);
        this.emptyModel = monaco.editor.createModel('<No output yet>', 'plaintext');
        this.editor.setModel(this.emptyModel);
        this.toDispose.push(Disposable.create(() => this.editor.dispose()));
    }

    @postConstruct()
    protected init(): void {
        this.toDispose.pushAll([
            // this.outputChannelManager.onChannelAdded(this.addChannel.bind(this)),
            // this.outputChannelManager.onChannelDelete(this.removeChannel.bind(this)),
            this.outputChannelManager.onSelectedChannelChange(() => this.editor.setModel(this.selectedChannel ? this.selectedChannel.model : this.emptyModel))
        ]);
    }

    protected onSelectedChannelChange(): void {
        this.toDisposeOnSelectedChannelChange.dispose();
        if (this.selectedChannel) {
            // this.selectedChannel.onContentChange(() => {
            //     this.editor.up
            // })
        }
        // this.toDisposeOnSelectedChannelChange
    }

    protected onAfterAttach(message: Message): void {
        super.onAfterAttach(message);
    }

    protected onActivateRequest(message: Message): void {
        super.onActivateRequest(message);
        if (this.editor) {
            this.editor.focus();
        } else {
            this.node.focus();
        }
    }

    clear(): void {
        if (this.selectedChannel) {
            this.selectedChannel.clear();
        }
    }

    selectAll(): void {
        const model = this.editor.getModel();
        if (model) {
            const endLine = model.getLineCount();
            const endCharacter = model.getLineLastNonWhitespaceColumn(endLine);
            this.editor.setSelection(new monaco.Range(1, 1, endLine, endCharacter));
        }
    }

    private get selectedChannel(): OutputChannel | undefined {
        return this.outputChannelManager.selectedChannel;
    }

}

/**
 * @deprecated Use `OutputWidget.ID` instead.
 */
export const OUTPUT_WIDGET_KIND = OutputWidget.ID;
