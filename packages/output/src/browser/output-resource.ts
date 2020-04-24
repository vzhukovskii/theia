/********************************************************************************
 * Copyright (C) 2020 TypeFox and others.
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

import { inject, injectable } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { Event, Resource, ResourceReadOptions, DisposableCollection, Emitter, ResourceResolver } from '@theia/core/lib/common';
import { OutputUri } from '../common/output-uri';
import { OutputChannelManager } from '../common/output-channel';

export class OutputResource implements Resource {

    protected onDidChangeContentsEmitter = new Emitter<void>();
    protected toDispose = new DisposableCollection(
        this.onDidChangeContentsEmitter
    );

    constructor(readonly model: monaco.editor.ITextModel) {
        this.toDispose.push(model.onDidChangeContent(() => this.onDidChangeContentsEmitter.fire()));
    }

    get uri(): URI {
        return new URI(this.model.uri);
    }

    get onDidChangeContents(): Event<void> {
        return this.onDidChangeContentsEmitter.event;
    }

    async readContents(options?: ResourceReadOptions): Promise<string> {
        return this.model.getValue();
    }

    dispose(): void {
        this.toDispose.dispose();
    }

}

@injectable()
export class OutputResourceResolver implements ResourceResolver {

    @inject(OutputChannelManager)
    protected readonly outputChannelManager: OutputChannelManager;

    async resolve(uri: URI): Promise<Resource> {
        if (!OutputUri.is(uri)) {
            throw new Error(`Expected '${OutputUri.SCHEME}' URI scheme. Got: ${uri} instead.`);
        }
        const name = uri.toString().slice(`${OutputUri.SCHEME}:/`.length);
        const { model } = this.outputChannelManager.getChannel(name);
        return new OutputResource(model);
    }

}
