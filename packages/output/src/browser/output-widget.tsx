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
import { Message, BaseWidget, /* MessageLoop, Widget */ } from '@theia/core/lib/browser';
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
        this.editor = monaco.editor.create(this.node, this.editorOptions());
        this.emptyModel = monaco.editor.createModel('<No output yet>', 'plaintext');
        this.toDispose.push(Disposable.create(() => this.editor.dispose()));
    }

    @postConstruct()
    protected init(): void {
        this.toDispose.pushAll([
            this.outputChannelManager.onSelectedChannelChanged(this.onSelectedChannelChange.bind(this))
        ]);
        this.onSelectedChannelChange();
    }

    protected onSelectedChannelChange(): void {
        this.toDisposeOnSelectedChannelChange.dispose();
        const model = this.selectedChannel ? this.selectedChannel.model : this.emptyModel;
        this.editor.setModel(model);
        this.editor.layout(undefined);
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        if (this.isVisible) {
            this.editor.layout(undefined);
        }
    }

    protected onAfterShow(msg: Message): void {
        super.onAfterShow(msg);
        this.editor.layout(undefined);
    }

    protected onActivateRequest(message: Message): void {
        super.onActivateRequest(message);
        this.editor.layout(undefined);
        this.editor.focus();
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

    protected editorOptions(): monaco.editor.IEditorOptions {
        return {
            overviewRulerLanes: 3,
            lineNumbersMinChars: 3,
            fixedOverflowWidgets: true,
            wordWrap: 'on',
            lineNumbers: 'off',
            glyphMargin: false,
            lineDecorationsWidth: 20,
            rulers: [],
            folding: false,
            scrollBeyondLastLine: false,
            readOnly: true,
            renderLineHighlight: 'none',
            minimap: { enabled: false },
        };
    }

    private get selectedChannel(): OutputChannel | undefined {
        return this.outputChannelManager.selectedChannel;
    }

}

/**
 * @deprecated Use `OutputWidget.ID` instead.
 */
export const OUTPUT_WIDGET_KIND = OutputWidget.ID;
