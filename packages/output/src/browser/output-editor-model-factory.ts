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

import { injectable } from 'inversify';
import { MonacoToProtocolConverter as M2P, ProtocolToMonacoConverter as P2M } from 'monaco-languageclient';
import { MonacoEditorModelFactory, MonacoEditorModel } from '@theia/monaco/lib/browser/monaco-editor-model';
import { OutputResource } from './output-resource';
import { Resource } from '@theia/core/src/common';

@injectable()
export class OutputEditorModelFactory extends MonacoEditorModelFactory {

    createModel(resource: Resource, options?: { encoding?: string | undefined }): MonacoEditorModel {
        if (resource instanceof OutputResource) {
            return new OutputEditorModel(resource, this.m2p, this.p2m, options);
        }
        return new MonacoEditorModel(resource, this.m2p, this.p2m, options);
    }

}

export class OutputEditorModel extends MonacoEditorModel {

    readonly autoSave = 'off';

    constructor(protected readonly resource: OutputResource, readonly m2p: M2P, readonly p2m: P2M, options?: { encoding?: string | undefined }) {
        super(resource, m2p, p2m, options);
    }

    /**
     * Unlike in the base implementation, we have the text-model for the output channel, so we do not have to
     * create it on the fly, and we must not dispose the it.
     */
    protected initialize(content: string): void {
        if (!this.toDispose.disposed) {
            this.model = this.resource.model;
            this.toDispose.push(this.model.onDidChangeContent(event => this.fireDidChangeContent(event)));
            if (this.resource.onDidChangeContents) {
                this.toDispose.push(this.resource.onDidChangeContents(() => this.sync()));
            }
        }
    }

}
