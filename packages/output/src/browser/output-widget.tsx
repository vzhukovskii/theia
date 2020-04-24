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
import { Message, BaseWidget, DockPanel, Widget, MessageLoop, /* MessageLoop, Widget */ } from '@theia/core/lib/browser';
import { MonacoEditorProvider } from '@theia/monaco/lib/browser/monaco-editor-provider';
import { OutputChannelManager, OutputChannel } from '../common/output-channel';
import { OutputUri } from '../common/output-uri';
// import { EditorWidget } from '@theia/editor/lib/browser';
import { EditorWidget } from '@theia/editor/lib/browser';
import { SelectionService } from '@theia/core/lib/common/selection-service';
import { IDragEvent } from '@phosphor/dragdrop';
import { toArray } from '@phosphor/algorithm';

@injectable()
export class OutputWidget extends BaseWidget {

    static readonly ID = 'outputView';

    @inject(OutputChannelManager)
    protected readonly outputChannelManager: OutputChannelManager;

    @inject(MonacoEditorProvider)
    protected readonly editorProvider: MonacoEditorProvider;

    @inject(SelectionService)
    protected readonly selectionService: SelectionService;

    protected editorContainer: DockPanel;

    protected readonly toDisposeOnSelectedChannelChanged = new DisposableCollection();

    constructor() {
        super();
        this.id = OutputWidget.ID;
        this.title.label = 'Output';
        this.title.caption = 'Output';
        this.title.iconClass = 'fa fa-flag';
        this.title.closable = true;
        this.addClass('theia-output');
        this.node.tabIndex = 0;
        this.editorContainer = new NoopDragOverDockPanel({ spacing: 0, mode: 'single-document' });
        this.editorContainer.addClass('editor-container');
        this.editorContainer.node.tabIndex = -1;
    }

    @postConstruct()
    protected init(): void {
        this.toDispose.push(this.outputChannelManager.onSelectedChannelChanged(this.onSelectedChannelChanged.bind(this)));
    }

    protected async onSelectedChannelChanged(): Promise<void> {
        this.toDisposeOnSelectedChannelChanged.dispose();
        const { selectedChannel } = this;
        if (selectedChannel) {
            const widget = await this.createEditorWidget();
            if (widget) {
                this.editorContainer.addWidget(widget);
                this.toDisposeOnSelectedChannelChanged.pushAll([
                    Disposable.create(() => widget.close()),
                    selectedChannel.onContentChange(() => {
                        if (!selectedChannel.isLocked) {
                            this.revealLastLine();
                        }
                    })
                ]);
            }
        }
    }

    protected onAfterAttach(message: Message): void {
        super.onAfterAttach(message);
        Widget.attach(this.editorContainer, this.node);
        this.toDisposeOnDetach.push(Disposable.create(() => Widget.detach(this.editorContainer)));
    }

    protected onActivateRequest(message: Message): void {
        super.onActivateRequest(message);
        if (this.selectedChannel) {
            for (const widget of toArray(this.editorContainer.widgets())) {
                MessageLoop.sendMessage(widget, Widget.Msg.ActivateRequest);
            }
        } else {
            this.node.focus();
        }
    }

    protected onResize(message: Widget.ResizeMessage): void {
        super.onResize(message);
        MessageLoop.sendMessage(this.editorContainer, Widget.ResizeMessage.UnknownSize);
        for (const widget of toArray(this.editorContainer.widgets())) {
            MessageLoop.sendMessage(widget, Widget.ResizeMessage.UnknownSize);
        }
    }

    clear(): void {
        if (this.selectedChannel) {
            this.selectedChannel.clear();
        }
    }

    selectAll(): void {
        // const model = this.editor.getModel();
        // if (model) {
        //     const endLine = model.getLineCount();
        //     const endCharacter = model.getLineMaxColumn(endLine);
        //     this.editor.setSelection(new monaco.Range(1, 1, endLine, endCharacter));
        // }
    }

    protected revealLastLine(): void {
        // if (this.editorWidget) {
        //     this.editorWidget.editor.refresh();
        //     this.editorWidget.editor.resizeToFit();
        // }
        // const lineNumber = this.model.getLineCount();
        // const column = this.model.getLineMaxColumn(lineNumber);
        // this.editor.revealPosition({ lineNumber, column }, monaco.editor.ScrollType.Smooth);
    }

    private get selectedChannel(): OutputChannel | undefined {
        return this.outputChannelManager.selectedChannel;
    }

    private async createEditorWidget(): Promise<EditorWidget | undefined> {
        if (!this.selectedChannel) {
            return undefined;
        }
        const { name } = this.selectedChannel;
        const editor = await this.editorProvider.get(OutputUri.create(name));
        return new EditorWidget(editor, this.selectionService);
    }

}

/**
 * @deprecated Use `OutputWidget.ID` instead.
 */
export const OUTPUT_WIDGET_KIND = OutputWidget.ID;

/**
 * Customized `DockPanel` that does not allow dropping widgets into it.
 * Intercepts `'p-dragover'` events, and sets the desired drop action to `'none'`.
 */
class NoopDragOverDockPanel extends DockPanel {

    constructor(options?: DockPanel.IOptions) {
        super(options);
        NoopDragOverDockPanel.prototype['_evtDragOver'] = (event: IDragEvent) => {
            event.preventDefault();
            event.stopPropagation();
            event.dropAction = 'none';
        };
    }
}
