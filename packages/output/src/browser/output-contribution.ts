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

import { injectable, inject } from 'inversify';
import { Command, CommandRegistry } from '@theia/core/lib/common';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { KeybindingRegistry, KeybindingContext, ApplicationShell } from '@theia/core/lib/browser';
import { OutputWidget } from './output-widget';

export namespace OutputCommands {

    const OUTPUT_CATEGORY = 'Output';

    /* #region VS Code `OutputChannel` API */
    // Based on: https://github.com/theia-ide/vscode/blob/standalone/0.19.x/src/vs/vscode.d.ts#L4692-L4745

    export const APPEND: Command = {
        id: 'output:append'
    };

    export const APPEND_LINE: Command = {
        id: 'output:appendLine'
    };

    export const CLEAR: Command = {
        id: 'output:clear'
    };

    export const SHOW: Command = {
        id: 'output:show'
    };

    export const HIDE: Command = {
        id: 'output:hide'
    };

    export const DISPOSE: Command = {
        id: 'output:dispose'
    };

    /* #endregion VS Code `OutputChannel` API */

    export const CLEAR__SELECTED: Command = {
        id: 'output:selected:clear',
        category: OUTPUT_CATEGORY,
        label: 'Clear Output of the Selected Channel',
        iconClass: 'clear-all'
    };

    // XXX: this will be obsolete, I guess after switching to monaco.
    export const SELECT_ALL__SELECTED: Command = {
        id: 'output:selected:selectAll',
        category: OUTPUT_CATEGORY,
        label: 'Select All'
    };

    export const SCROLL_LOCK__SELECTED: Command = {
        id: 'output:selected:scrollLock',
        label: 'Toggle Auto Scroll in Selected Channel',
        category: OUTPUT_CATEGORY
    };

}

/**
 * Enabled when the `Output` widget is the `activeWidget` in the shell.
 */
@injectable()
export class OutputWidgetIsActiveContext implements KeybindingContext {

    static readonly ID = 'output:isActive';

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    readonly id = OutputWidgetIsActiveContext.ID;

    isEnabled(): boolean {
        return this.shell.activeWidget instanceof OutputWidget;
    }

}

// TODO: rename to `OutputViewContribution` to better reflect to what it does.
@injectable()
export class OutputContribution extends AbstractViewContribution<OutputWidget> {

    @inject(OutputWidgetIsActiveContext)
    protected readonly outputIsActiveContext: OutputWidgetIsActiveContext;

    constructor() {
        super({
            widgetId: OutputWidget.ID,
            widgetName: 'Output',
            defaultWidgetOptions: {
                area: 'bottom'
            },
            toggleCommandId: 'output:toggle',
            toggleKeybinding: 'CtrlCmd+Shift+U'
        });
    }

    registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
        const isEnabled = (() => this.outputIsActiveContext.isEnabled()).bind(this);
        const isVisible = isEnabled;
        commands.registerCommand(OutputCommands.CLEAR__SELECTED, {
            isEnabled,
            isVisible,
            execute: () => this.widget.then(widget => widget.clear())
        });
        commands.registerCommand(OutputCommands.SELECT_ALL__SELECTED, {
            isEnabled,
            isVisible,
            execute: () => this.widget.then(widget => widget.selectAll())
        });
        commands.registerCommand(OutputCommands.SCROLL_LOCK__SELECTED, {
            isEnabled,
            isVisible,
            execute: () => {

            }
        });
    }

    // See comment on `SELECT_ALL__SELECTED`, I think we won't need this.
    registerKeybindings(registry: KeybindingRegistry): void {
        super.registerKeybindings(registry);
        registry.registerKeybindings({
            command: OutputCommands.SELECT_ALL__SELECTED.id,
            keybinding: 'CtrlCmd+A',
            context: OutputWidgetIsActiveContext.ID
        });
    }

}
